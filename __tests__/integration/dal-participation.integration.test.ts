import { describe, expect, it, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import { EditionStatus } from "@/generated/prisma/enums";
import {
  addTea,
  assignDay,
  enrolGuest,
  enrolUser,
  getAssignees,
  getDayByDayNumber,
  getDaysForEdition,
  getParticipationsForEdition,
  unassignDay,
  upsertEdition,
} from "@/lib/dal";
import { ConflictError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

// The seed gives 2025 an active edition with 25 days: day 1 manager (with tea), day 2 guest "Anónimo"
// (with tea), days 3, 4 and 5 to ana, sony and miko, the rest free.
const beforeTheEdition = new Date("2025-11-15T12:00:00+01:00");
const duringTheEdition = new Date("2025-12-10T12:00:00+01:00");

async function day(dayNumber: number) {
  const found = await getDayByDayNumber({ dayNumber, year: 2025 });
  if (!found) {
    throw new Error(`seed has no day ${dayNumber}`);
  }
  return found;
}

/** Makes the next transaction fail the way Prisma does when a concurrent request changes the rows under it. */
function failNextTransaction(code: string) {
  const error = new Prisma.PrismaClientKnownRequestError("simulated race", { clientVersion: "test", code });
  return vi.spyOn(prisma, "$transaction").mockRejectedValueOnce(error);
}

async function userWithoutDay() {
  return prisma.user.findFirstOrThrow({ where: { participations: { none: {} } } });
}

describe("dal Participation", () => {
  describe("getAssignees", () => {
    it("returns the people of the given edition only, users and guests alike", async () => {
      await upsertEdition(2030, EditionStatus.PREPARING);
      const otherDay = await prisma.day.create({ data: { dayNumber: 1, year: 2030 } });
      await prisma.participation.create({ data: { dayId: otherDay.id, guestName: "Fantasma", year: 2030 } });

      const assignees = await getAssignees(2025);

      expect(assignees).toHaveLength(5);
      expect(assignees.map((assignee) => assignee.guestName ?? assignee.user?.username)).toContain("Anónimo");
      expect(assignees.map((assignee) => assignee.guestName)).not.toContain("Fantasma");
    });
  });

  describe("getParticipationsForEdition", () => {
    it("returns everyone in the edition with their day number, enrolled without a day included", async () => {
      const enrolled = await enrolGuest(2025, "Prima Lejana");

      const participations = await getParticipationsForEdition(2025);

      expect(participations).toHaveLength(6);
      expect(participations.find((participation) => participation.guestName === "Anónimo")).toMatchObject({
        day: { dayNumber: 2 },
        user: null,
        userId: null,
      });
      expect(participations.find((participation) => participation.id === enrolled.id)?.day).toBeNull();
    });

    it("says who has a tea, with or without a day", async () => {
      const enrolled = await enrolGuest(2025, "Prima Lejana");
      await addTea(
        { addMilk: false, canReinfuse: false, hasTheine: true, infusionTime: 3, name: "Sin día", temperature: 80 },
        [],
        enrolled.id,
      );

      const participations = await getParticipationsForEdition(2025);

      const withTea = participations.filter((participation) => participation.tea !== null);
      expect(withTea.map((participation) => participation.day?.dayNumber ?? null).toSorted()).toEqual([1, 2, null]);
    });

    it("never loads the guest token or anything of the account but the username", async () => {
      await enrolGuest(2025, "Prima Lejana");

      const participations = await getParticipationsForEdition(2025);

      for (const participation of participations) {
        expect(participation).not.toHaveProperty("guestToken");
        if (participation.user) {
          expect(Object.keys(participation.user)).toEqual(["username"]);
        }
      }
    });

    it("leaves out the other editions", async () => {
      await upsertEdition(2030, EditionStatus.PREPARING);
      await enrolGuest(2030, "Fantasma");

      const participations = await getParticipationsForEdition(2025);

      expect(participations.map((participation) => participation.guestName)).not.toContain("Fantasma");
    });
  });

  describe("getDaysForEdition", () => {
    it("returns the days of the edition in order", async () => {
      const days = await getDaysForEdition(2025);

      expect(days.map((item) => item.dayNumber)).toEqual(Array.from({ length: 25 }, (_, index) => index + 1));
    });

    it("returns nothing for an edition without days", async () => {
      await upsertEdition(2030, EditionStatus.PREPARING);

      expect(await getDaysForEdition(2030)).toEqual([]);
    });
  });

  describe("assignDay", () => {
    it("puts a user with no participation on a free day, taking the year from the day", async () => {
      const user = await userWithoutDay();
      const free = await day(6);

      const result = await assignDay(free.id, { userId: user.id }, beforeTheEdition);

      expect(result).toMatchObject({ dayId: free.id, guestName: null, userId: user.id, year: 2025 });
      expect(result.day?.dayNumber).toBe(6);
      expect(result.user?.id).toBe(user.id);
    });

    it("is idempotent for the person already on the day", async () => {
      const three = await day(3);
      const current = await prisma.participation.findUniqueOrThrow({ where: { dayId: three.id } });

      const result = await assignDay(three.id, { userId: current.userId! }, beforeTheEdition);

      expect(result.id).toBe(current.id);
      expect(await prisma.participation.count({ where: { year: 2025 } })).toBe(5);
    });

    it("refuses a day held by someone else and names them", async () => {
      const four = await day(4);
      const ana = await prisma.participation.findUniqueOrThrow({ where: { dayId: (await day(3)).id } });

      await expect(assignDay(four.id, { userId: ana.userId! }, beforeTheEdition)).rejects.toThrow(ConflictError);
      await expect(assignDay(four.id, { userId: ana.userId! }, beforeTheEdition)).rejects.toThrow(/Sony/);
    });

    it("refuses to move in silence a user who already has another day this year", async () => {
      const ana = await prisma.participation.findUniqueOrThrow({ where: { dayId: (await day(3)).id } });
      const free = await day(7);

      await expect(assignDay(free.id, { userId: ana.userId! }, beforeTheEdition)).rejects.toThrow(/el día 3/);
      expect((await prisma.participation.findUniqueOrThrow({ where: { id: ana.id } })).dayId).toBe(ana.dayId);
    });

    it("gives the day to a user enrolled without one, reusing their participation", async () => {
      const user = await userWithoutDay();
      const enrolled = await prisma.participation.create({
        data: { edition: { connect: { year: 2025 } }, user: { connect: { id: user.id } } },
      });
      const free = await day(8);

      const result = await assignDay(free.id, { userId: user.id }, beforeTheEdition);

      expect(result.id).toBe(enrolled.id);
      expect(result.dayId).toBe(free.id);
    });

    it("creates a guest participation on a free day", async () => {
      const free = await day(9);

      const result = await assignDay(free.id, { guestName: "Prima Lejana" }, beforeTheEdition);

      expect(result).toMatchObject({ dayId: free.id, guestName: "Prima Lejana", userId: null, year: 2025 });
    });

    it("still accepts the person already on a day that has opened, since nothing changes", async () => {
      const three = await day(3);
      const current = await prisma.participation.findUniqueOrThrow({ where: { dayId: three.id } });

      const result = await assignDay(three.id, { userId: current.userId! }, duringTheEdition);

      expect(result.id).toBe(current.id);
    });

    it("refuses a day that has already opened", async () => {
      const user = await userWithoutDay();
      const past = await day(7);

      await expect(assignDay(past.id, { userId: user.id }, duringTheEdition)).rejects.toThrow(/ya ha pasado o es hoy/);
    });

    it("rejects an unknown day as invalid input, not as a conflict", async () => {
      await expect(assignDay("no-such-day", { guestName: "Nadie" }, beforeTheEdition)).rejects.toThrow(
        /does not exist/,
      );
    });
  });

  describe("unassignDay", () => {
    it("frees the day and keeps the person enrolled without one", async () => {
      const three = await day(3);
      const before = await prisma.participation.findUniqueOrThrow({ where: { dayId: three.id } });

      await unassignDay(three.id, beforeTheEdition);

      const after = await prisma.participation.findUniqueOrThrow({ where: { id: before.id } });
      expect(after.dayId).toBeNull();
      expect(after.userId).toBe(before.userId);
    });

    it("frees a day whose holder has a tea: the tea stays with the person", async () => {
      const one = await day(1);
      const before = await prisma.participation.findUniqueOrThrow({
        include: { tea: true },
        where: { dayId: one.id },
      });

      await unassignDay(one.id, beforeTheEdition);

      const after = await prisma.participation.findUniqueOrThrow({ include: { tea: true }, where: { id: before.id } });
      expect(after.dayId).toBeNull();
      expect(after.tea?.id).toBe(before.tea!.id);
    });

    it("refuses to free a day that has already opened", async () => {
      const three = await day(3);

      await expect(unassignDay(three.id, duringTheEdition)).rejects.toThrow(ConflictError);
    });

    it("does nothing on a free day", async () => {
      const free = await day(10);

      await expect(unassignDay(free.id, beforeTheEdition)).resolves.toBeUndefined();
    });
  });

  describe("enrolUser", () => {
    it("enrols a user in the edition without a day", async () => {
      const user = await userWithoutDay();

      const result = await enrolUser(2025, user.id);

      expect(result).toMatchObject({ dayId: null, guestName: null, guestToken: null, userId: user.id, year: 2025 });
    });

    it("is idempotent: enrolling twice keeps a single participation", async () => {
      const user = await userWithoutDay();

      const first = await enrolUser(2025, user.id);
      const second = await enrolUser(2025, user.id);

      expect(second.id).toBe(first.id);
      expect(await prisma.participation.count({ where: { userId: user.id, year: 2025 } })).toBe(1);
    });

    it("leaves the day of someone who already has one", async () => {
      const ana = await prisma.participation.findUniqueOrThrow({ where: { dayId: (await day(3)).id } });

      const result = await enrolUser(2025, ana.userId!);

      expect(result.id).toBe(ana.id);
      expect(result.dayId).toBe(ana.dayId);
    });

    it("enrols the same user in another edition as a separate participation", async () => {
      await upsertEdition(2030, EditionStatus.PREPARING);
      const ana = await prisma.participation.findUniqueOrThrow({ where: { dayId: (await day(3)).id } });

      const result = await enrolUser(2030, ana.userId!);

      expect(result.id).not.toBe(ana.id);
      expect(result).toMatchObject({ dayId: null, userId: ana.userId, year: 2030 });
    });

    it("refuses an edition that does not exist", async () => {
      const user = await userWithoutDay();

      await expect(enrolUser(2099, user.id)).rejects.toThrow(ConflictError);
      await expect(enrolUser(2099, user.id)).rejects.toThrow(/no existe/);
    });

    it("refuses an archived edition", async () => {
      await upsertEdition(2030, EditionStatus.ARCHIVED);
      const user = await userWithoutDay();

      await expect(enrolUser(2030, user.id)).rejects.toThrow(ConflictError);
      await expect(enrolUser(2030, user.id)).rejects.toThrow(/archivada/);
      expect(await prisma.participation.count({ where: { year: 2030 } })).toBe(0);
    });

    it("refuses a user that does not exist, as a conflict", async () => {
      await expect(enrolUser(2025, "no-such-user")).rejects.toThrow(ConflictError);
    });

    it("returns the participation another request created at the same moment", async () => {
      const user = await userWithoutDay();
      const existing = await enrolUser(2025, user.id);
      failNextTransaction("P2002");

      const result = await enrolUser(2025, user.id);

      expect(result.id).toBe(existing.id);
    });

    it.each(["P2003", "P2025"])(
      "reports a conflict when the account or the edition disappears mid-way (%s)",
      async (code) => {
        const user = await userWithoutDay();
        failNextTransaction(code);

        await expect(enrolUser(2025, user.id)).rejects.toThrow(
          new ConflictError("Esa persona o la edición 2025 ya no existen."),
        );
      },
    );

    it("lets any other database error through untouched", async () => {
      const user = await userWithoutDay();
      failNextTransaction("P2024");

      await expect(enrolUser(2025, user.id)).rejects.toThrow(Prisma.PrismaClientKnownRequestError);
    });
  });

  describe("enrolGuest", () => {
    it("enrols a guest without a day and with a secret token", async () => {
      const result = await enrolGuest(2025, "Prima Lejana");

      expect(result).toMatchObject({ dayId: null, guestName: "Prima Lejana", userId: null, year: 2025 });
      // 32 random bytes in base64url.
      expect(result.guestToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    });

    it("gives every guest a different token", async () => {
      const first = await enrolGuest(2025, "Prima Lejana");
      const second = await enrolGuest(2025, "Tío Segundo");

      expect(second.guestToken).not.toBe(first.guestToken);
    });

    it("stores the name without the spaces around it", async () => {
      const result = await enrolGuest(2025, "  Prima Lejana  ");

      expect(result.guestName).toBe("Prima Lejana");
    });

    it.each(["Anónimo", "anónimo", " ANÓNIMO "])(
      "refuses %j because the edition already has that guest, and names the existing one",
      async (name) => {
        await expect(enrolGuest(2025, name)).rejects.toThrow(ConflictError);
        await expect(enrolGuest(2025, name)).rejects.toThrow(/Anónimo/);
        expect(await prisma.participation.count({ where: { guestName: { not: null }, year: 2025 } })).toBe(1);
      },
    );

    it.each(["Anonimo", "ANÓNIMO", "  anónimo "])(
      "refuses %j: accents and capitals do not make another name",
      async (name) => {
        await expect(enrolGuest(2025, name)).rejects.toThrow(
          new ConflictError("Anónimo ya está en la edición 2025 como invitado."),
        );
      },
    );

    it("refuses a name that differs from a guest's only in the spaces inside", async () => {
      await enrolGuest(2025, "Prima Lejana");

      await expect(enrolGuest(2025, "Prima   Lejana")).rejects.toThrow(ConflictError);
    });

    it.each(["Sony", "sony", "Nita"])(
      "refuses %j because an account in the edition goes by that name",
      async (name) => {
        await expect(enrolGuest(2025, name)).rejects.toThrow(ConflictError);
        await expect(enrolGuest(2025, name)).rejects.toThrow(
          /Ya hay una cuenta llamada (Sony|Ñita) en la edición 2025/,
        );
      },
    );

    it("accepts the name of an account that is not in the edition", async () => {
      const user = await userWithoutDay();

      const result = await enrolGuest(2025, user.username);

      expect(result.guestName).toBe(user.username);
    });

    it("reports a conflict when the edition disappears mid-way", async () => {
      failNextTransaction("P2003");

      await expect(enrolGuest(2025, "Prima Lejana")).rejects.toThrow(
        new ConflictError("La edición 2025 ya no existe."),
      );
    });

    it.each(["An_nimo", "%", "An%"])("accepts %j: a wildcard character is just a character", async (name) => {
      const result = await enrolGuest(2025, name);

      expect(result.guestName).toBe(name);
    });

    it.each(["", "   "])("rejects the empty name %j as invalid input, not as a conflict", async (name) => {
      await expect(enrolGuest(2025, name)).rejects.toThrow(/guest name is empty/);
      await expect(enrolGuest(2025, name)).rejects.not.toThrow(ConflictError);
      expect(await prisma.participation.count({ where: { guestName: { not: null }, year: 2025 } })).toBe(1);
    });

    it("accepts in another edition a name that an earlier one already has", async () => {
      await upsertEdition(2030, EditionStatus.PREPARING);

      const result = await enrolGuest(2030, "Anónimo");

      expect(result).toMatchObject({ guestName: "Anónimo", year: 2030 });
    });

    it("refuses an edition that does not exist", async () => {
      await expect(enrolGuest(2099, "Prima Lejana")).rejects.toThrow(ConflictError);
      await expect(enrolGuest(2099, "Prima Lejana")).rejects.toThrow(/no existe/);
    });

    it("refuses an archived edition", async () => {
      await upsertEdition(2030, EditionStatus.ARCHIVED);

      await expect(enrolGuest(2030, "Prima Lejana")).rejects.toThrow(ConflictError);
      await expect(enrolGuest(2030, "Prima Lejana")).rejects.toThrow(/archivada/);
      expect(await prisma.participation.count({ where: { year: 2030 } })).toBe(0);
    });
  });
});

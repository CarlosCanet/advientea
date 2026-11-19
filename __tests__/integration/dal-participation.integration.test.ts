import { describe, expect, it } from "vitest";

import { EditionStatus } from "@/generated/prisma/enums";
import {
  assignDay,
  enrolGuest,
  enrolUser,
  getAssignees,
  getDayByDayNumber,
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

    it("refuses to free a day that holds a tea", async () => {
      const one = await day(1);

      await expect(unassignDay(one.id, beforeTheEdition)).rejects.toThrow(/tiene un té/);
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

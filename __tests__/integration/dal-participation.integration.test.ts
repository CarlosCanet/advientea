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
  placeParticipant,
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

  describe("placeParticipant", () => {
    // An edition has one day per participant. The seed's five hold days 1 to 5, so a free number
    // within the calendar only exists once more people are enrolled.
    async function enrolGuests(count: number, year = 2025) {
      const guests: Awaited<ReturnType<typeof enrolGuest>>[] = [];
      for (let index = 1; index <= count; index++) {
        guests.push(await enrolGuest(year, `Invitada ${index}`));
      }
      return guests;
    }

    async function participationOn(dayNumber: number) {
      return prisma.participation.findUniqueOrThrow({ where: { dayId: (await day(dayNumber)).id } });
    }

    async function removeDayRows(...dayNumbers: number[]) {
      await prisma.day.deleteMany({ where: { dayNumber: { in: dayNumbers }, year: 2025 } });
    }

    /** Which day rows the 2025 edition has and who is on each: what a refusal must leave as it was. */
    async function placements() {
      const [days, participations] = await Promise.all([
        prisma.day.findMany({
          orderBy: { dayNumber: "asc" },
          select: { dayNumber: true, id: true },
          where: { year: 2025 },
        }),
        prisma.participation.findMany({
          orderBy: { id: "asc" },
          select: { dayId: true, id: true },
          where: { year: 2025 },
        }),
      ]);
      return { days, participations };
    }

    it("places someone enrolled without a day on the day with that number", async () => {
      const user = await userWithoutDay();
      const enrolled = await enrolUser(2025, user.id);
      const six = await day(6);
      const before = await placements();

      const result = await placeParticipant(enrolled.id, 6, beforeTheEdition);

      expect(result).toMatchObject({ dayId: six.id, id: enrolled.id, userId: user.id, year: 2025 });
      expect(result.day?.dayNumber).toBe(6);
      expect(result.user?.id).toBe(user.id);
      expect((await prisma.participation.findUniqueOrThrow({ where: { id: enrolled.id } })).dayId).toBe(six.id);
      expect((await placements()).days).toEqual(before.days);
    });

    it("places a guest the same way", async () => {
      const guest = await enrolGuest(2025, "Prima Lejana");
      const six = await day(6);

      const result = await placeParticipant(guest.id, 6, beforeTheEdition);

      expect(result).toMatchObject({
        dayId: six.id,
        guestName: "Prima Lejana",
        id: guest.id,
        user: null,
        userId: null,
      });
      expect(result.day?.dayNumber).toBe(6);
      expect((await prisma.participation.findUniqueOrThrow({ where: { id: guest.id } })).dayId).toBe(six.id);
    });

    it("refuses a number above the number of participants, says the range and creates no day", async () => {
      const [guest] = await enrolGuests(1);
      const before = await placements();

      await expect(placeParticipant(guest.id, 26, beforeTheEdition)).rejects.toThrow(ConflictError);
      await expect(placeParticipant(guest.id, 26, beforeTheEdition)).rejects.toThrow(
        new ConflictError("La edición 2025 tiene 6 participantes: elige un día entre 1 y 6."),
      );
      expect(await placements()).toEqual(before);
    });

    it("has no bound but the number of participants: with 34 enrolled, day 34 is valid and day 35 is not", async () => {
      const [guest] = await enrolGuests(29);

      await expect(placeParticipant(guest.id, 35, beforeTheEdition)).rejects.toThrow(
        new ConflictError("La edición 2025 tiene 34 participantes: elige un día entre 1 y 34."),
      );
      const result = await placeParticipant(guest.id, 34, beforeTheEdition);

      expect(result.day).toMatchObject({ dayNumber: 34, year: 2025 });
      expect((await participationOn(34)).id).toBe(guest.id);
    });

    it("creates the row of a day within the calendar that has none yet", async () => {
      const [guest] = await enrolGuests(1);
      await removeDayRows(6);

      const result = await placeParticipant(guest.id, 6, beforeTheEdition);

      expect(result.day).toMatchObject({ dayNumber: 6, year: 2025 });
      const created = await day(6);
      expect(result.dayId).toBe(created.id);
      expect((await prisma.participation.findUniqueOrThrow({ where: { id: guest.id } })).dayId).toBe(created.id);
    });

    it("creates only the row asked for, not the missing ones below it", async () => {
      const [guest] = await enrolGuests(3);
      await removeDayRows(6, 7, 8);
      const before = await placements();

      await placeParticipant(guest.id, 8, beforeTheEdition);

      const after = await placements();
      expect(after.days.map((item) => item.dayNumber)).toEqual(
        [...before.days.map((item) => item.dayNumber), 8].toSorted((a, b) => a - b),
      );
    });

    it("accepts a number it refused once one more person is enrolled", async () => {
      const [guest] = await enrolGuests(1);
      await expect(placeParticipant(guest.id, 7, beforeTheEdition)).rejects.toThrow(
        new ConflictError("La edición 2025 tiene 6 participantes: elige un día entre 1 y 6."),
      );

      await enrolUser(2025, (await userWithoutDay()).id);
      const result = await placeParticipant(guest.id, 7, beforeTheEdition);

      expect(result.day?.dayNumber).toBe(7);
      expect((await participationOn(7)).id).toBe(guest.id);
    });

    it.each([7, 25])("refuses day %i, a free leftover row above the number of participants", async (dayNumber) => {
      const [guest] = await enrolGuests(1);
      await day(dayNumber);
      const before = await placements();

      await expect(placeParticipant(guest.id, dayNumber, beforeTheEdition)).rejects.toThrow(ConflictError);
      await expect(placeParticipant(guest.id, dayNumber, beforeTheEdition)).rejects.toThrow(
        new ConflictError("La edición 2025 tiene 6 participantes: elige un día entre 1 y 6."),
      );
      expect(await placements()).toEqual(before);
    });

    it("refuses to move someone to a leftover row above the number of participants: they keep their day", async () => {
      const ana = await participationOn(3);
      await day(6);
      const before = await placements();

      await expect(placeParticipant(ana.id, 6, beforeTheEdition)).rejects.toThrow(
        new ConflictError("La edición 2025 tiene 5 participantes: elige un día entre 1 y 5."),
      );
      expect(await placements()).toEqual(before);
      expect((await participationOn(3)).id).toBe(ana.id);
    });

    it("moves someone off a leftover day above the calendar to a free day within it", async () => {
      const twenty = await day(20);
      const stray = await prisma.participation.create({
        data: { dayId: twenty.id, guestName: "Prima Lejana", year: 2025 },
      });

      const result = await placeParticipant(stray.id, 6, beforeTheEdition);

      expect(result.id).toBe(stray.id);
      expect(result.day?.dayNumber).toBe(6);
      expect((await participationOn(6)).id).toBe(stray.id);
      expect(await prisma.day.findUnique({ where: { id: twenty.id } })).not.toBeNull();
      expect(await prisma.participation.findUnique({ where: { dayId: twenty.id } })).toBeNull();
    });

    it("changes nothing when asked for the leftover day above the calendar the person already holds", async () => {
      const twenty = await day(20);
      const stray = await prisma.participation.create({
        data: { dayId: twenty.id, guestName: "Prima Lejana", year: 2025 },
      });
      const before = await placements();

      const result = await placeParticipant(stray.id, 20, beforeTheEdition);

      expect(result.id).toBe(stray.id);
      expect(result.day?.dayNumber).toBe(20);
      expect(await placements()).toEqual(before);
    });

    it("moves someone who already holds a day and leaves the old day free", async () => {
      await enrolGuests(1);
      const ana = await participationOn(3);
      const six = await day(6);

      const result = await placeParticipant(ana.id, 6, beforeTheEdition);

      expect(result.id).toBe(ana.id);
      expect(result.day?.dayNumber).toBe(6);
      expect((await prisma.participation.findUniqueOrThrow({ where: { id: ana.id } })).dayId).toBe(six.id);
      expect(await prisma.day.findUnique({ where: { id: ana.dayId! } })).toMatchObject({ dayNumber: 3, year: 2025 });
      expect(await prisma.participation.findUnique({ where: { dayId: ana.dayId! } })).toBeNull();
      expect(await prisma.participation.count({ where: { year: 2025 } })).toBe(6);
    });

    it("moves someone to a day whose row does not exist yet, leaving the old day free", async () => {
      await enrolGuests(1);
      await removeDayRows(6);
      const ana = await participationOn(3);

      const result = await placeParticipant(ana.id, 6, beforeTheEdition);

      expect(result.day).toMatchObject({ dayNumber: 6, year: 2025 });
      expect((await participationOn(6)).id).toBe(ana.id);
      expect(await prisma.day.findUnique({ where: { id: ana.dayId! } })).not.toBeNull();
      expect(await prisma.participation.findUnique({ where: { dayId: ana.dayId! } })).toBeNull();
    });

    it("moves someone with a tea and leaves the tea row exactly as it was", async () => {
      await enrolGuests(1);
      const manager = await participationOn(1);
      const tea = await prisma.tea.findUniqueOrThrow({ where: { participationId: manager.id } });

      const result = await placeParticipant(manager.id, 6, beforeTheEdition);

      expect(result.id).toBe(manager.id);
      expect(result.day?.dayNumber).toBe(6);
      expect((await participationOn(6)).id).toBe(manager.id);
      const teaAfter = await prisma.tea.findUniqueOrThrow({ where: { id: tea.id } });
      expect(teaAfter.participationId).toBe(manager.id);
      expect(teaAfter).toEqual(tea);
      expect(await prisma.tea.count()).toBe(2);
    });

    it("moves a guest with a tea: the tea stays with the guest", async () => {
      await enrolGuests(1);
      const guest = await participationOn(2);
      const tea = await prisma.tea.findUniqueOrThrow({ where: { participationId: guest.id } });

      const result = await placeParticipant(guest.id, 6, beforeTheEdition);

      expect(result).toMatchObject({ guestName: "Anónimo", id: guest.id, user: null });
      expect(result.day?.dayNumber).toBe(6);
      expect((await participationOn(6)).id).toBe(guest.id);
      expect(await prisma.participation.findUnique({ where: { dayId: guest.dayId! } })).toBeNull();
      expect(await prisma.tea.findUniqueOrThrow({ where: { participationId: guest.id } })).toMatchObject({
        id: tea.id,
        name: "Pakistaní",
      });
    });

    it("changes nothing when asked for the day the person already holds", async () => {
      const ana = await participationOn(3);
      const before = await placements();

      const result = await placeParticipant(ana.id, 3, beforeTheEdition);

      expect(result.id).toBe(ana.id);
      expect(result.day?.dayNumber).toBe(3);
      expect(await placements()).toEqual(before);
    });

    it("still accepts the day the person already holds once it has opened, since nothing changes", async () => {
      const ana = await participationOn(3);
      const before = await placements();

      const result = await placeParticipant(ana.id, 3, duringTheEdition);

      expect(result.id).toBe(ana.id);
      expect(result.day?.dayNumber).toBe(3);
      expect(await placements()).toEqual(before);
    });

    it("refuses a day held by an account and names it, leaving the person without a day", async () => {
      const [guest] = await enrolGuests(1);
      const before = await placements();

      await expect(placeParticipant(guest.id, 4, beforeTheEdition)).rejects.toThrow(ConflictError);
      await expect(placeParticipant(guest.id, 4, beforeTheEdition)).rejects.toThrow(/Sony/);
      expect(await placements()).toEqual(before);
      expect((await prisma.participation.findUniqueOrThrow({ where: { id: guest.id } })).dayId).toBeNull();
    });

    it("refuses a day held by a guest and names them: both keep the days they had", async () => {
      const ana = await participationOn(3);
      const guest = await participationOn(2);
      const before = await placements();

      await expect(placeParticipant(ana.id, 2, beforeTheEdition)).rejects.toThrow(ConflictError);
      await expect(placeParticipant(ana.id, 2, beforeTheEdition)).rejects.toThrow(/Anónimo/);
      expect(await placements()).toEqual(before);
      expect((await participationOn(3)).id).toBe(ana.id);
      expect((await participationOn(2)).id).toBe(guest.id);
    });

    it("refuses to move someone onto a day held by another account: both keep the days they had", async () => {
      const ana = await participationOn(3);
      const sony = await participationOn(4);

      await expect(placeParticipant(ana.id, 4, beforeTheEdition)).rejects.toThrow(ConflictError);
      await expect(placeParticipant(ana.id, 4, beforeTheEdition)).rejects.toThrow(/Sony/);
      expect((await participationOn(3)).id).toBe(ana.id);
      expect((await participationOn(4)).id).toBe(sony.id);
    });

    it.each([7, 10])("refuses day %i of the calendar once it has opened", async (dayNumber) => {
      const [guest] = await enrolGuests(5);
      const before = await placements();

      await expect(placeParticipant(guest.id, dayNumber, duringTheEdition)).rejects.toThrow(ConflictError);
      await expect(placeParticipant(guest.id, dayNumber, duringTheEdition)).rejects.not.toThrow(/participantes/);
      expect(await placements()).toEqual(before);
    });

    it("refuses to move someone whose own day has opened, even to a day that has not", async () => {
      await enrolGuests(10);
      const ana = await participationOn(3);
      const before = await placements();

      await expect(placeParticipant(ana.id, 15, duringTheEdition)).rejects.toThrow(ConflictError);
      await expect(placeParticipant(ana.id, 15, duringTheEdition)).rejects.not.toThrow(/participantes/);
      expect(await placements()).toEqual(before);
    });

    it("refuses to move someone whose own day has opened to a day without a row, and does not create it", async () => {
      await enrolGuests(10);
      await removeDayRows(15);
      const ana = await participationOn(3);
      const before = await placements();

      await expect(placeParticipant(ana.id, 15, duringTheEdition)).rejects.toThrow(ConflictError);
      await expect(placeParticipant(ana.id, 15, duringTheEdition)).rejects.not.toThrow(/participantes/);
      expect(await placements()).toEqual(before);
    });

    it("refuses to move someone from a day that has not opened to one that has", async () => {
      const [late] = await enrolGuests(7);
      await prisma.participation.update({ data: { dayId: (await day(12)).id }, where: { id: late.id } });
      const before = await placements();

      await expect(placeParticipant(late.id, 6, duringTheEdition)).rejects.toThrow(ConflictError);
      await expect(placeParticipant(late.id, 6, duringTheEdition)).rejects.not.toThrow(/participantes/);
      expect(await placements()).toEqual(before);
    });

    it("refuses to create the row of a day whose date has already passed", async () => {
      const [guest] = await enrolGuests(3);
      await removeDayRows(8);
      const before = await placements();

      await expect(placeParticipant(guest.id, 8, duringTheEdition)).rejects.toThrow(ConflictError);
      await expect(placeParticipant(guest.id, 8, duringTheEdition)).rejects.not.toThrow(/participantes/);
      expect(await placements()).toEqual(before);
    });

    it("places someone on a day that has not opened while the edition is running", async () => {
      const [guest] = await enrolGuests(6);

      const result = await placeParticipant(guest.id, 11, duringTheEdition);

      expect(result.day?.dayNumber).toBe(11);
      expect((await participationOn(11)).id).toBe(guest.id);
    });

    it("moves someone between two days that have not opened while the edition is running", async () => {
      const [late] = await enrolGuests(8);
      const twelve = await day(12);
      await prisma.participation.update({ data: { dayId: twelve.id }, where: { id: late.id } });

      const result = await placeParticipant(late.id, 13, duringTheEdition);

      expect(result.day?.dayNumber).toBe(13);
      expect((await participationOn(13)).id).toBe(late.id);
      expect(await prisma.participation.findUnique({ where: { dayId: twelve.id } })).toBeNull();
    });

    it("counts a day past 31 as a day of January: day 32 has opened on 2 January, day 34 has not", async () => {
      const [guest] = await enrolGuests(29);
      await prisma.day.createMany({
        data: [
          { dayNumber: 32, year: 2025 },
          { dayNumber: 34, year: 2025 },
        ],
      });
      const secondOfJanuary = new Date("2026-01-02T12:00:00+01:00");

      await expect(placeParticipant(guest.id, 32, secondOfJanuary)).rejects.toThrow(ConflictError);
      await expect(placeParticipant(guest.id, 32, secondOfJanuary)).rejects.not.toThrow(/participantes/);
      expect((await prisma.participation.findUniqueOrThrow({ where: { id: guest.id } })).dayId).toBeNull();

      const result = await placeParticipant(guest.id, 34, secondOfJanuary);

      expect(result.day?.dayNumber).toBe(34);
      expect((await participationOn(34)).id).toBe(guest.id);
    });

    it("places a participation of another edition on that edition's day, creating it, and leaves 2025 alone", async () => {
      await upsertEdition(2030, EditionStatus.PREPARING);
      const [ghost] = await enrolGuests(3, 2030);
      const ana = await participationOn(3);
      const before = await placements();

      const result = await placeParticipant(ghost.id, 3, beforeTheEdition);

      expect(result.day).toMatchObject({ dayNumber: 3, year: 2030 });
      const otherDays = await prisma.day.findMany({ include: { participation: true }, where: { year: 2030 } });
      expect(otherDays).toHaveLength(1);
      expect(otherDays[0]).toMatchObject({ dayNumber: 3, participation: { id: ghost.id } });
      expect(await placements()).toEqual(before);
      expect((await participationOn(3)).id).toBe(ana.id);
    });

    it("uses the day the other edition already has instead of creating another", async () => {
      await upsertEdition(2030, EditionStatus.PREPARING);
      const otherDay = await prisma.day.create({ data: { dayNumber: 2, year: 2030 } });
      const [ghost] = await enrolGuests(2, 2030);
      const before = await placements();

      const result = await placeParticipant(ghost.id, 2, beforeTheEdition);

      expect(result.dayId).toBe(otherDay.id);
      expect(await prisma.day.count({ where: { year: 2030 } })).toBe(1);
      expect(await placements()).toEqual(before);
    });

    it("counts the participants of its own edition only", async () => {
      await upsertEdition(2030, EditionStatus.PREPARING);
      const [ghost] = await enrolGuests(2, 2030);
      const guest = await enrolGuest(2025, "Prima Lejana");

      await expect(placeParticipant(ghost.id, 3, beforeTheEdition)).rejects.toThrow(
        new ConflictError("La edición 2030 tiene 2 participantes: elige un día entre 1 y 2."),
      );
      await expect(placeParticipant(guest.id, 7, beforeTheEdition)).rejects.toThrow(
        new ConflictError("La edición 2025 tiene 6 participantes: elige un día entre 1 y 6."),
      );
      expect(await prisma.day.count({ where: { year: 2030 } })).toBe(0);
    });

    it("rejects an unknown participation as invalid input, not as a conflict", async () => {
      const before = await placements();
      const dayRows = await prisma.day.count();

      await expect(placeParticipant("no-such-participation", 1, beforeTheEdition)).rejects.not.toThrow(ConflictError);
      await expect(placeParticipant("no-such-participation", 26, beforeTheEdition)).rejects.not.toThrow(ConflictError);
      expect(await placements()).toEqual(before);
      expect(await prisma.day.count()).toBe(dayRows);
    });

    it.each([0, -1, 2.5])("rejects %j as a day number as invalid input, not as a conflict", async (dayNumber) => {
      const [guest] = await enrolGuests(1);
      const before = await placements();

      await expect(placeParticipant(guest.id, dayNumber, beforeTheEdition)).rejects.not.toThrow(ConflictError);
      expect(await placements()).toEqual(before);
    });

    it.each([0, -1, 2.5])("rejects %j for someone who holds a day, who keeps it", async (dayNumber) => {
      const ana = await participationOn(3);
      const before = await placements();

      await expect(placeParticipant(ana.id, dayNumber, beforeTheEdition)).rejects.not.toThrow(ConflictError);
      expect(await placements()).toEqual(before);
    });

    it.each([
      { rowExists: true, target: "the same free day" },
      { rowExists: false, target: "the same free day whose row does not exist yet" },
    ])("lets only one of two people placed at once on $target", async ({ rowExists }) => {
      const first = await enrolGuest(2025, "Prima Lejana");
      const second = await enrolUser(2025, (await userWithoutDay()).id);
      if (!rowExists) {
        await removeDayRows(6);
      }

      const results = await Promise.allSettled([
        placeParticipant(first.id, 6, beforeTheEdition),
        placeParticipant(second.id, 6, beforeTheEdition),
      ]);

      const placed = results.filter((result) => result.status === "fulfilled");
      const refused = results.filter((result) => result.status === "rejected");
      expect(placed).toHaveLength(1);
      expect(refused).toHaveLength(1);
      expect(refused[0].reason).toBeInstanceOf(ConflictError);

      const target = await prisma.day.findMany({
        include: { participation: true },
        where: { dayNumber: 6, year: 2025 },
      });
      expect(target).toHaveLength(1);
      expect(target[0].participation?.id).toBe(placed[0].value.id);
      const pair = await prisma.participation.findMany({ where: { id: { in: [first.id, second.id] } } });
      expect(pair.filter((participation) => participation.dayId === target[0].id)).toHaveLength(1);
      expect(pair.filter((participation) => participation.dayId === null)).toHaveLength(1);
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

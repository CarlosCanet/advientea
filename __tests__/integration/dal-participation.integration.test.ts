import { afterEach, describe, expect, it, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import { EditionStatus } from "@/generated/prisma/enums";
import {
  addTea,
  assignDay,
  enrolGuest,
  enrolUser,
  getAssignees,
  getDayByDayNumber,
  getParticipationsForEdition,
  placeParticipant,
  swapParticipants,
  unassignDay,
  unplaceParticipant,
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

type Placements = Awaited<ReturnType<typeof placements>>;

/** The participations of `before` with the given ones moved to their new day, or to none. */
function withDays(before: Placements, moved: Record<string, null | string>) {
  return before.participations.map((participation) =>
    participation.id in moved ? { ...participation, dayId: moved[participation.id] } : participation,
  );
}

// Straight to the row: placing through the DAL is bound to the number of participants and to the days
// that have not opened, and these tests need people on days outside both.
async function putOnDay(participationId: string, dayNumber: number) {
  return prisma.participation.update({ data: { dayId: (await day(dayNumber)).id }, where: { id: participationId } });
}

async function setEditionStatus(status: EditionStatus, year = 2025) {
  await prisma.edition.update({ data: { status }, where: { year } });
}

async function expectConflict(call: Promise<unknown>, message: string) {
  const error: unknown = await call.catch((reason: unknown) => reason);
  expect(error).toBeInstanceOf(ConflictError);
  expect((error as ConflictError).message).toBe(message);
}

async function expectInvalidInput(call: Promise<unknown>, message: string) {
  const error: unknown = await call.catch((reason: unknown) => reason);
  expect(error).toBeInstanceOf(Error);
  expect(error).not.toBeInstanceOf(ConflictError);
  expect((error as Error).message).toBe(message);
}

const DAY_HAS_OPENED = "Ese día ya ha pasado o es hoy y no se puede cambiar.";
const NO_LONGER_THERE = "Esa inscripción o ese día ya no existen.";
const DAYS_JUST_CHANGED = "Los días acaban de cambiar. Recarga la página y vuelve a intentarlo.";

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
    // A simulated failure that the call never reaches would otherwise break the reset of the next test.
    afterEach(() => {
      vi.restoreAllMocks();
    });

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

    it("returns the placement when the database reports a clash and the person is already on that day", async () => {
      const [guest] = await enrolGuests(1);
      const six = await day(6);
      await placeParticipant(guest.id, 6, beforeTheEdition);
      const before = await placements();
      const transaction = failNextTransaction("P2002");

      const result = await placeParticipant(guest.id, 6, beforeTheEdition);

      // Without this the call could have answered before ever writing, and the clash would not be exercised.
      expect(transaction).toHaveBeenCalled();
      expect(result).toMatchObject({ dayId: six.id, guestName: "Invitada 1", id: guest.id, year: 2025 });
      expect(result.day?.dayNumber).toBe(6);
      expect(await placements()).toEqual(before);
    });

    it("reports that the day has just gone to someone else when the database reports a clash", async () => {
      const [guest] = await enrolGuests(1);
      const before = await placements();
      failNextTransaction("P2002");

      const error: unknown = await placeParticipant(guest.id, 6, beforeTheEdition).catch((reason: unknown) => reason);

      expect(error).toBeInstanceOf(ConflictError);
      expect((error as ConflictError).message).toBe("El día 6 acaba de asignarse a otra persona.");
      expect(await placements()).toEqual(before);
      expect((await prisma.participation.findUniqueOrThrow({ where: { id: guest.id } })).dayId).toBeNull();
    });

    it("reports the same clash to someone who holds another day, who keeps it", async () => {
      await enrolGuests(1);
      const ana = await participationOn(3);
      const before = await placements();
      failNextTransaction("P2002");

      const error: unknown = await placeParticipant(ana.id, 6, beforeTheEdition).catch((reason: unknown) => reason);

      expect(error).toBeInstanceOf(ConflictError);
      expect((error as ConflictError).message).toBe("El día 6 acaba de asignarse a otra persona.");
      expect(await placements()).toEqual(before);
      expect((await participationOn(3)).id).toBe(ana.id);
    });

    it.each(["P2003", "P2025"])(
      "reports a conflict when the participation or the day disappears mid-way (%s)",
      async (code) => {
        const [guest] = await enrolGuests(1);
        const before = await placements();
        failNextTransaction(code);

        const error: unknown = await placeParticipant(guest.id, 6, beforeTheEdition).catch((reason: unknown) => reason);

        expect(error).toBeInstanceOf(ConflictError);
        expect((error as ConflictError).message).toBe("Esa inscripción o ese día ya no existen.");
        expect(await placements()).toEqual(before);
      },
    );

    it("lets any other database error through untouched", async () => {
      const [guest] = await enrolGuests(1);
      const before = await placements();
      const transaction = failNextTransaction("P2024");

      const error: unknown = await placeParticipant(guest.id, 6, beforeTheEdition).catch((reason: unknown) => reason);

      expect(error).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
      expect(error).not.toBeInstanceOf(ConflictError);
      expect(error).toMatchObject({ code: "P2024", message: "simulated race" });
      // The very object the database layer threw, not a copy or a wrapper.
      expect(error).toBe(transaction.mock.settledResults[0].value);
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
      const before = await placements();

      const results = await Promise.allSettled([
        placeParticipant(first.id, 6, beforeTheEdition),
        placeParticipant(second.id, 6, beforeTheEdition),
      ]);

      // Which of the two wins depends on timing, and so does the message the other one gets.
      expect(results.map((result) => result.status).toSorted()).toEqual(["fulfilled", "rejected"]);
      const firstWon = results[0].status === "fulfilled";
      const [winner, loser] = firstWon ? [first, second] : [second, first];
      const [placed, refused] = firstWon ? results : results.toReversed();
      if (placed.status !== "fulfilled" || refused.status !== "rejected") {
        throw new Error("one call was expected to succeed and the other to fail");
      }
      expect(refused.reason).toBeInstanceOf(ConflictError);
      expect(placed.value.id).toBe(winner.id);
      expect(placed.value.day).toMatchObject({ dayNumber: 6, year: 2025 });

      const target = await prisma.day.findMany({ where: { dayNumber: 6, year: 2025 } });
      expect(target).toHaveLength(1);
      expect(placed.value.dayId).toBe(target[0].id);
      const holders = await prisma.participation.findMany({ where: { dayId: target[0].id } });
      expect(holders.map((participation) => participation.id)).toEqual([winner.id]);
      expect((await prisma.participation.findUniqueOrThrow({ where: { id: loser.id } })).dayId).toBeNull();

      // Nobody else moved, nobody was enrolled twice and no other day row appeared.
      const after = await placements();
      expect(after.participations).toEqual(
        before.participations.map((participation) =>
          participation.id === winner.id ? { ...participation, dayId: target[0].id } : participation,
        ),
      );
      expect(after.days.map((item) => item.dayNumber)).toEqual(
        [...new Set([...before.days.map((item) => item.dayNumber), 6])].toSorted((a, b) => a - b),
      );
    });
  });

  describe("unplaceParticipant", () => {
    // A simulated failure that the call never reaches would otherwise break the reset of the next test.
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("leaves someone who holds a day without one: the day row stays, held by nobody", async () => {
      const ana = await participationOn(3);
      const before = await placements();

      const result = await unplaceParticipant(ana.id, beforeTheEdition);

      expect(result).toMatchObject({ day: null, dayId: null, id: ana.id, userId: ana.userId, year: 2025 });
      expect(result.user?.id).toBe(ana.userId);
      const after = await placements();
      expect(after.days).toEqual(before.days);
      expect(after.participations).toEqual(withDays(before, { [ana.id]: null }));
      expect(await prisma.participation.findUnique({ where: { dayId: ana.dayId! } })).toBeNull();
      expect(await prisma.participation.count({ where: { year: 2025 } })).toBe(5);
    });

    it("leaves a guest without a day the same way", async () => {
      const guest = await participationOn(2);
      const before = await placements();

      const result = await unplaceParticipant(guest.id, beforeTheEdition);

      expect(result).toMatchObject({
        day: null,
        dayId: null,
        guestName: "Anónimo",
        id: guest.id,
        user: null,
        userId: null,
      });
      const after = await placements();
      expect(after.days).toEqual(before.days);
      expect(after.participations).toEqual(withDays(before, { [guest.id]: null }));
    });

    it.each([
      { dayNumber: 1, holder: "an account" },
      { dayNumber: 2, holder: "a guest" },
    ])("leaves the tea of $holder exactly as it was and still theirs", async ({ dayNumber }) => {
      const holder = await participationOn(dayNumber);
      const tea = await prisma.tea.findUniqueOrThrow({ where: { participationId: holder.id } });

      const result = await unplaceParticipant(holder.id, beforeTheEdition);

      expect(result).toMatchObject({ day: null, dayId: null, id: holder.id });
      expect(await prisma.tea.findUniqueOrThrow({ where: { participationId: holder.id } })).toEqual(tea);
      expect(await prisma.tea.count()).toBe(2);
    });

    it("takes someone off a leftover day above the number of participants", async () => {
      const stray = await enrolGuest(2025, "Prima Lejana");
      await putOnDay(stray.id, 20);
      const before = await placements();

      const result = await unplaceParticipant(stray.id, beforeTheEdition);

      expect(result).toMatchObject({ day: null, dayId: null, id: stray.id });
      const after = await placements();
      expect(after.days).toEqual(before.days);
      expect(after.participations).toEqual(withDays(before, { [stray.id]: null }));
    });

    it("resolves with the participation as it was when the person holds no day", async () => {
      const guest = await enrolGuest(2025, "Prima Lejana");
      const before = await placements();

      const result = await unplaceParticipant(guest.id, duringTheEdition);

      expect(result).toMatchObject({
        day: null,
        dayId: null,
        guestName: "Prima Lejana",
        id: guest.id,
        user: null,
        year: 2025,
      });
      expect(await placements()).toEqual(before);
    });

    it("resolves for someone without a day in an archived edition too", async () => {
      const user = await userWithoutDay();
      const enrolled = await enrolUser(2025, user.id);
      await setEditionStatus(EditionStatus.ARCHIVED);
      const before = await placements();

      const result = await unplaceParticipant(enrolled.id, beforeTheEdition);

      expect(result).toMatchObject({ day: null, dayId: null, id: enrolled.id, userId: user.id });
      expect(result.user?.id).toBe(user.id);
      expect(await placements()).toEqual(before);
    });

    it("refuses someone whose day has already opened, who keeps it", async () => {
      const ana = await participationOn(3);
      const before = await placements();

      await expectConflict(unplaceParticipant(ana.id, duringTheEdition), DAY_HAS_OPENED);
      expect(await placements()).toEqual(before);
    });

    it("refuses the day that opens today and frees the one that opens tomorrow", async () => {
      const [today, tomorrow] = await enrolGuests(2);
      await putOnDay(today.id, 10);
      await putOnDay(tomorrow.id, 11);
      const before = await placements();

      await expectConflict(unplaceParticipant(today.id, duringTheEdition), DAY_HAS_OPENED);
      const result = await unplaceParticipant(tomorrow.id, duringTheEdition);

      expect(result).toMatchObject({ day: null, dayId: null, id: tomorrow.id });
      const after = await placements();
      expect(after.days).toEqual(before.days);
      expect(after.participations).toEqual(withDays(before, { [tomorrow.id]: null }));
    });

    it("refuses every day of an archived edition, whatever the date", async () => {
      const ana = await participationOn(3);
      await setEditionStatus(EditionStatus.ARCHIVED);
      const before = await placements();

      await expectConflict(unplaceParticipant(ana.id, beforeTheEdition), DAY_HAS_OPENED);
      expect(await placements()).toEqual(before);
    });

    it("frees any day of an edition in preparation, whatever the date", async () => {
      const ana = await participationOn(3);
      await setEditionStatus(EditionStatus.PREPARING);
      const before = await placements();

      const result = await unplaceParticipant(ana.id, duringTheEdition);

      expect(result).toMatchObject({ day: null, dayId: null, id: ana.id });
      expect((await placements()).participations).toEqual(withDays(before, { [ana.id]: null }));
    });

    it("rejects an unknown participation as invalid input, not as a conflict", async () => {
      const before = await placements();

      await expectInvalidInput(
        unplaceParticipant("no-such-participation", beforeTheEdition),
        "The participation with id no-such-participation does not exist.",
      );
      expect(await placements()).toEqual(before);
    });

    it.each(["P2003", "P2025"])(
      "reports a conflict when the participation or the day disappears mid-way (%s)",
      async (code) => {
        const ana = await participationOn(3);
        const before = await placements();
        failNextTransaction(code);

        await expectConflict(unplaceParticipant(ana.id, beforeTheEdition), NO_LONGER_THERE);
        expect(await placements()).toEqual(before);
      },
    );

    it("lets any other database error through untouched", async () => {
      const ana = await participationOn(3);
      const before = await placements();
      const transaction = failNextTransaction("P2024");

      const error: unknown = await unplaceParticipant(ana.id, beforeTheEdition).catch((reason: unknown) => reason);

      expect(error).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
      expect(error).not.toBeInstanceOf(ConflictError);
      expect(error).toMatchObject({ code: "P2024", message: "simulated race" });
      // The very object the database layer threw, not a copy or a wrapper.
      expect(error).toBe(transaction.mock.settledResults[0].value);
      expect(await placements()).toEqual(before);
    });
  });

  describe("swapParticipants", () => {
    const SWAPPED_WITH_ITSELF = "A participation cannot be swapped with itself.";
    const DIFFERENT_EDITIONS = "The participations belong to different editions.";

    type Swap = [string, string];

    function dayIdsAfter(start: Map<string, null | string>, swaps: Swap[]) {
      const held = new Map(start);
      for (const [first, second] of swaps) {
        const dayOfFirst = held.get(first) ?? null;
        held.set(first, held.get(second) ?? null);
        held.set(second, dayOfFirst);
      }
      return held;
    }

    /** Sends the swaps at once and checks what must hold whichever of them gets there first. */
    async function raceSwaps(people: string[], swaps: Swap[]) {
      const before = await placements();
      const dayIdsOf = (from: Placements) =>
        people.map((id) => from.participations.find((participation) => participation.id === id)?.dayId ?? null);
      const daysHeld = (dayIds: (null | string)[]) =>
        dayIds.filter((dayId): dayId is string => dayId !== null).toSorted();

      const results = await Promise.allSettled(
        swaps.map(([first, second]) => swapParticipants(first, second, beforeTheEdition)),
      );

      for (const result of results) {
        if (result.status === "rejected") {
          expect(result.reason).toBeInstanceOf(ConflictError);
        }
      }
      const after = await placements();
      // Between them the same days as before, one each: nobody shares a day and no day is lost.
      expect(daysHeld(dayIdsOf(after))).toEqual(daysHeld(dayIdsOf(before)));
      expect(after.days).toEqual(before.days);
      expect(after.participations.filter((participation) => !people.includes(participation.id))).toEqual(
        before.participations.filter((participation) => !people.includes(participation.id)),
      );
      // All or nothing: a swap that was refused changed nothing, and the ones that resolved were done whole,
      // one after the other in whichever order they got in.
      const done = swaps.filter((_, index) => results[index].status === "fulfilled");
      const start = new Map(before.participations.map((participation) => [participation.id, participation.dayId]));
      const outcomes = [done, done.toReversed()].map((order) => {
        const held = dayIdsAfter(start, order);
        return people.map((id) => held.get(id) ?? null);
      });
      expect(outcomes).toContainEqual(dayIdsOf(after));
    }

    // Who wins a race is a matter of timing, so each one is run a few times, from wherever the last left things.
    const ROUNDS = 5;

    // A simulated failure that the call never reaches would otherwise break the reset of the next test.
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("puts each of two people who hold a day on the other's day, and answers in argument order", async () => {
      const ana = await participationOn(3);
      const sony = await participationOn(4);
      const before = await placements();

      const result = await swapParticipants(ana.id, sony.id, beforeTheEdition);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({ dayId: sony.dayId, id: ana.id, userId: ana.userId, year: 2025 });
      expect(result[0].day?.dayNumber).toBe(4);
      expect(result[0].user?.id).toBe(ana.userId);
      expect(result[1]).toMatchObject({ dayId: ana.dayId, id: sony.id, userId: sony.userId, year: 2025 });
      expect(result[1].day?.dayNumber).toBe(3);
      expect(result[1].user?.id).toBe(sony.userId);
      const after = await placements();
      expect(after.days).toEqual(before.days);
      expect(after.participations).toEqual(withDays(before, { [ana.id]: sony.dayId, [sony.id]: ana.dayId }));
    });

    it("answers in the order of its arguments when they come the other way round", async () => {
      const ana = await participationOn(3);
      const sony = await participationOn(4);
      const before = await placements();

      const result = await swapParticipants(sony.id, ana.id, beforeTheEdition);

      expect(result[0]).toMatchObject({ dayId: ana.dayId, id: sony.id });
      expect(result[0].day?.dayNumber).toBe(3);
      expect(result[1]).toMatchObject({ dayId: sony.dayId, id: ana.id });
      expect(result[1].day?.dayNumber).toBe(4);
      expect((await placements()).participations).toEqual(
        withDays(before, { [ana.id]: sony.dayId, [sony.id]: ana.dayId }),
      );
    });

    it.each([{ holder: "first" }, { holder: "second" }])(
      "passes the day to the one without when the $holder of the two holds it",
      async ({ holder }) => {
        const ana = await participationOn(3);
        const guest = await enrolGuest(2025, "Prima Lejana");
        const before = await placements();

        const result =
          holder === "first"
            ? await swapParticipants(ana.id, guest.id, beforeTheEdition)
            : await swapParticipants(guest.id, ana.id, beforeTheEdition);

        const [fromAna, fromGuest] = holder === "first" ? result : [result[1], result[0]];
        expect(fromAna).toMatchObject({ day: null, dayId: null, id: ana.id, userId: ana.userId });
        expect(fromAna.user?.id).toBe(ana.userId);
        expect(fromGuest).toMatchObject({ dayId: ana.dayId, guestName: "Prima Lejana", id: guest.id, user: null });
        expect(fromGuest.day?.dayNumber).toBe(3);
        const after = await placements();
        expect(after.days).toEqual(before.days);
        expect(after.participations).toEqual(withDays(before, { [ana.id]: null, [guest.id]: ana.dayId }));
      },
    );

    it("leaves both teas with their people, each now reached through the other's day", async () => {
      const manager = await participationOn(1);
      const guest = await participationOn(2);
      const teas = await prisma.tea.findMany({ orderBy: { id: "asc" } });

      const result = await swapParticipants(manager.id, guest.id, beforeTheEdition);

      expect(result[0]).toMatchObject({ dayId: guest.dayId, id: manager.id, userId: manager.userId });
      expect(result[1]).toMatchObject({ dayId: manager.dayId, guestName: "Anónimo", id: guest.id, user: null });
      expect(await prisma.tea.findMany({ orderBy: { id: "asc" } })).toEqual(teas);
      const [dayOne, dayTwo] = await Promise.all(
        [manager.dayId!, guest.dayId!].map((id) =>
          prisma.day.findUniqueOrThrow({ include: { participation: { include: { tea: true } } }, where: { id } }),
        ),
      );
      expect(dayOne.participation).toMatchObject({ id: guest.id, tea: { name: "Pakistaní" } });
      expect(dayTwo.participation).toMatchObject({ id: manager.id, tea: { name: "Ruta del desierto" } });
    });

    it("leaves the tea with someone who passes their day to a person without one", async () => {
      const manager = await participationOn(1);
      const guest = await enrolGuest(2025, "Prima Lejana");
      const tea = await prisma.tea.findUniqueOrThrow({ where: { participationId: manager.id } });

      await swapParticipants(manager.id, guest.id, beforeTheEdition);

      expect(await prisma.tea.findUniqueOrThrow({ where: { id: tea.id } })).toEqual(tea);
      expect(await prisma.tea.count()).toBe(2);
      const dayOne = await prisma.day.findUniqueOrThrow({
        include: { participation: { include: { tea: true } } },
        where: { id: manager.dayId! },
      });
      expect(dayOne.participation).toMatchObject({ id: guest.id, tea: null });
      expect((await prisma.participation.findUniqueOrThrow({ where: { id: manager.id } })).dayId).toBeNull();
    });

    it("swaps two guests", async () => {
      const anonymous = await participationOn(2);
      const [guest] = await enrolGuests(1);
      const { dayId: six } = await putOnDay(guest.id, 6);
      const before = await placements();

      const result = await swapParticipants(anonymous.id, guest.id, beforeTheEdition);

      expect(result[0]).toMatchObject({ dayId: six, guestName: "Anónimo", id: anonymous.id, user: null });
      expect(result[0].day?.dayNumber).toBe(6);
      expect(result[1]).toMatchObject({ dayId: anonymous.dayId, guestName: "Invitada 1", id: guest.id, user: null });
      expect(result[1].day?.dayNumber).toBe(2);
      const after = await placements();
      expect(after.days).toEqual(before.days);
      expect(after.participations).toEqual(withDays(before, { [anonymous.id]: six, [guest.id]: anonymous.dayId }));
    });

    it("swaps someone on a leftover day above the number of participants like anyone else", async () => {
      const ana = await participationOn(3);
      const stray = await enrolGuest(2025, "Prima Lejana");
      const { dayId: twenty } = await putOnDay(stray.id, 20);
      const before = await placements();

      const result = await swapParticipants(stray.id, ana.id, beforeTheEdition);

      expect(result[0]).toMatchObject({ dayId: ana.dayId, id: stray.id });
      expect(result[0].day?.dayNumber).toBe(3);
      expect(result[1]).toMatchObject({ dayId: twenty, id: ana.id });
      expect(result[1].day?.dayNumber).toBe(20);
      const after = await placements();
      expect(after.days).toEqual(before.days);
      expect(after.participations).toEqual(withDays(before, { [ana.id]: twenty, [stray.id]: ana.dayId }));
    });

    it("passes a leftover day above the number of participants to someone without a day", async () => {
      const [stray, other] = await enrolGuests(2);
      const { dayId: twenty } = await putOnDay(stray.id, 20);
      const before = await placements();

      const result = await swapParticipants(other.id, stray.id, beforeTheEdition);

      expect(result[0]).toMatchObject({ dayId: twenty, id: other.id });
      expect(result[0].day?.dayNumber).toBe(20);
      expect(result[1]).toMatchObject({ day: null, dayId: null, id: stray.id });
      const after = await placements();
      expect(after.days).toEqual(before.days);
      expect(after.participations).toEqual(withDays(before, { [other.id]: twenty, [stray.id]: null }));
    });

    it("swaps two people of another edition and leaves 2025 alone", async () => {
      await upsertEdition(2030, EditionStatus.PREPARING);
      const [first, second] = await enrolGuests(2, 2030);
      const one = await prisma.day.create({ data: { dayNumber: 1, year: 2030 } });
      const two = await prisma.day.create({ data: { dayNumber: 2, year: 2030 } });
      await prisma.participation.update({ data: { dayId: one.id }, where: { id: first.id } });
      await prisma.participation.update({ data: { dayId: two.id }, where: { id: second.id } });
      const before = await placements();

      const result = await swapParticipants(first.id, second.id, beforeTheEdition);

      expect(result[0]).toMatchObject({ dayId: two.id, id: first.id, year: 2030 });
      expect(result[1]).toMatchObject({ dayId: one.id, id: second.id, year: 2030 });
      expect((await prisma.participation.findUniqueOrThrow({ where: { id: first.id } })).dayId).toBe(two.id);
      expect((await prisma.participation.findUniqueOrThrow({ where: { id: second.id } })).dayId).toBe(one.id);
      expect(await prisma.day.count({ where: { year: 2030 } })).toBe(2);
      expect(await placements()).toEqual(before);
    });

    it("resolves with both as they were when neither holds a day", async () => {
      const [first, second] = await enrolGuests(2);
      const before = await placements();

      const result = await swapParticipants(first.id, second.id, duringTheEdition);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({ day: null, dayId: null, guestName: "Invitada 1", id: first.id });
      expect(result[1]).toMatchObject({ day: null, dayId: null, guestName: "Invitada 2", id: second.id });
      expect(await placements()).toEqual(before);
    });

    it("resolves for two people without a day in an archived edition too", async () => {
      const [first, second] = await enrolGuests(2);
      await setEditionStatus(EditionStatus.ARCHIVED);
      const before = await placements();

      const result = await swapParticipants(first.id, second.id, beforeTheEdition);

      expect(result[0]).toMatchObject({ day: null, dayId: null, id: first.id });
      expect(result[1]).toMatchObject({ day: null, dayId: null, id: second.id });
      expect(await placements()).toEqual(before);
    });

    it("rejects swapping a participation with itself as invalid input, before looking it up", async () => {
      const ana = await participationOn(3);
      const before = await placements();

      await expectInvalidInput(swapParticipants(ana.id, ana.id, beforeTheEdition), SWAPPED_WITH_ITSELF);
      await expectInvalidInput(
        swapParticipants("no-such-participation", "no-such-participation", beforeTheEdition),
        SWAPPED_WITH_ITSELF,
      );
      expect(await placements()).toEqual(before);
    });

    it("rejects an unknown participation as invalid input and names the first unknown one", async () => {
      const ana = await participationOn(3);
      const before = await placements();

      await expectInvalidInput(
        swapParticipants("no-such-participation", ana.id, beforeTheEdition),
        "The participation with id no-such-participation does not exist.",
      );
      await expectInvalidInput(
        swapParticipants(ana.id, "no-such-participation", beforeTheEdition),
        "The participation with id no-such-participation does not exist.",
      );
      await expectInvalidInput(
        swapParticipants("gone-first", "gone-second", beforeTheEdition),
        "The participation with id gone-first does not exist.",
      );
      expect(await placements()).toEqual(before);
    });

    it("rejects two participations of different editions as invalid input, whatever their days", async () => {
      await upsertEdition(2030, EditionStatus.PREPARING);
      const [ghost] = await enrolGuests(1, 2030);
      const ana = await participationOn(3);
      const guest = await enrolGuest(2025, "Prima Lejana");
      const before = await placements();

      await expectInvalidInput(swapParticipants(ana.id, ghost.id, beforeTheEdition), DIFFERENT_EDITIONS);
      await expectInvalidInput(swapParticipants(ghost.id, ana.id, beforeTheEdition), DIFFERENT_EDITIONS);
      // Said before finding that there is nothing to swap, and before finding that a day has opened.
      await expectInvalidInput(swapParticipants(guest.id, ghost.id, beforeTheEdition), DIFFERENT_EDITIONS);
      await expectInvalidInput(swapParticipants(ana.id, ghost.id, duringTheEdition), DIFFERENT_EDITIONS);
      expect(await placements()).toEqual(before);
      expect((await prisma.participation.findUniqueOrThrow({ where: { id: ghost.id } })).dayId).toBeNull();
      expect(await prisma.day.count({ where: { year: 2030 } })).toBe(0);
    });

    it("refuses two days that have already opened: both keep theirs", async () => {
      const ana = await participationOn(3);
      const sony = await participationOn(4);
      const before = await placements();

      await expectConflict(swapParticipants(ana.id, sony.id, duringTheEdition), DAY_HAS_OPENED);
      expect(await placements()).toEqual(before);
    });

    it.each([{ opened: "first" }, { opened: "second" }])(
      "refuses when only the day of the $opened of the two has opened",
      async ({ opened }) => {
        const ana = await participationOn(3);
        const [late] = await enrolGuests(7);
        await putOnDay(late.id, 12);
        const before = await placements();

        await expectConflict(
          opened === "first"
            ? swapParticipants(ana.id, late.id, duringTheEdition)
            : swapParticipants(late.id, ana.id, duringTheEdition),
          DAY_HAS_OPENED,
        );
        expect(await placements()).toEqual(before);
      },
    );

    it.each([{ holder: "first" }, { holder: "second" }])(
      "refuses to pass on a day that has opened to someone without one (held by the $holder)",
      async ({ holder }) => {
        const ana = await participationOn(3);
        const guest = await enrolGuest(2025, "Prima Lejana");
        const before = await placements();

        await expectConflict(
          holder === "first"
            ? swapParticipants(ana.id, guest.id, duringTheEdition)
            : swapParticipants(guest.id, ana.id, duringTheEdition),
          DAY_HAS_OPENED,
        );
        expect(await placements()).toEqual(before);
      },
    );

    it("refuses the day that opens today and swaps the ones that open later", async () => {
      const [today, tomorrow, later] = await enrolGuests(7);
      await putOnDay(today.id, 10);
      const { dayId: eleven } = await putOnDay(tomorrow.id, 11);
      const { dayId: twelve } = await putOnDay(later.id, 12);
      const before = await placements();

      await expectConflict(swapParticipants(today.id, tomorrow.id, duringTheEdition), DAY_HAS_OPENED);
      await expectConflict(swapParticipants(tomorrow.id, today.id, duringTheEdition), DAY_HAS_OPENED);
      expect(await placements()).toEqual(before);

      const result = await swapParticipants(tomorrow.id, later.id, duringTheEdition);

      expect(result[0].day?.dayNumber).toBe(12);
      expect(result[1].day?.dayNumber).toBe(11);
      const after = await placements();
      expect(after.days).toEqual(before.days);
      expect(after.participations).toEqual(withDays(before, { [later.id]: eleven, [tomorrow.id]: twelve }));
    });

    it("refuses every day of an archived edition, whatever the date", async () => {
      const ana = await participationOn(3);
      const sony = await participationOn(4);
      const guest = await enrolGuest(2025, "Prima Lejana");
      await setEditionStatus(EditionStatus.ARCHIVED);
      const before = await placements();

      await expectConflict(swapParticipants(ana.id, sony.id, beforeTheEdition), DAY_HAS_OPENED);
      await expectConflict(swapParticipants(ana.id, guest.id, beforeTheEdition), DAY_HAS_OPENED);
      await expectConflict(swapParticipants(guest.id, ana.id, beforeTheEdition), DAY_HAS_OPENED);
      expect(await placements()).toEqual(before);
    });

    it("swaps any two days of an edition in preparation, whatever the date", async () => {
      const ana = await participationOn(3);
      const sony = await participationOn(4);
      await setEditionStatus(EditionStatus.PREPARING);
      const before = await placements();

      const result = await swapParticipants(ana.id, sony.id, duringTheEdition);

      expect(result[0].day?.dayNumber).toBe(4);
      expect(result[1].day?.dayNumber).toBe(3);
      expect((await placements()).participations).toEqual(
        withDays(before, { [ana.id]: sony.dayId, [sony.id]: ana.dayId }),
      );
    });

    it("reports that the days have just changed when the database reports a clash", async () => {
      const ana = await participationOn(3);
      const sony = await participationOn(4);
      const before = await placements();
      failNextTransaction("P2002");

      await expectConflict(swapParticipants(ana.id, sony.id, beforeTheEdition), DAYS_JUST_CHANGED);
      expect(await placements()).toEqual(before);
    });

    it("reports the same clash when only one of the two holds a day", async () => {
      const ana = await participationOn(3);
      const guest = await enrolGuest(2025, "Prima Lejana");
      const before = await placements();
      failNextTransaction("P2002");

      await expectConflict(swapParticipants(guest.id, ana.id, beforeTheEdition), DAYS_JUST_CHANGED);
      expect(await placements()).toEqual(before);
    });

    it.each(["P2003", "P2025"])(
      "reports a conflict when a participation or a day disappears mid-way (%s)",
      async (code) => {
        const ana = await participationOn(3);
        const sony = await participationOn(4);
        const before = await placements();
        failNextTransaction(code);

        await expectConflict(swapParticipants(ana.id, sony.id, beforeTheEdition), NO_LONGER_THERE);
        expect(await placements()).toEqual(before);
      },
    );

    it("lets any other database error through untouched", async () => {
      const ana = await participationOn(3);
      const sony = await participationOn(4);
      const before = await placements();
      const transaction = failNextTransaction("P2024");

      const error: unknown = await swapParticipants(ana.id, sony.id, beforeTheEdition).catch(
        (reason: unknown) => reason,
      );

      expect(error).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
      expect(error).not.toBeInstanceOf(ConflictError);
      expect(error).toMatchObject({ code: "P2024", message: "simulated race" });
      // The very object the database layer threw, not a copy or a wrapper.
      expect(error).toBe(transaction.mock.settledResults[0].value);
      expect(await placements()).toEqual(before);
    });

    it("keeps the three days, one each, when A<->B and B<->C arrive at once", async () => {
      const [ana, sony, miko] = [await participationOn(3), await participationOn(4), await participationOn(5)];

      for (let round = 0; round < ROUNDS; round++) {
        await raceSwaps(
          [ana.id, sony.id, miko.id],
          [
            [ana.id, sony.id],
            [sony.id, miko.id],
          ],
        );
      }
    });

    it("keeps the two days, one each, when A<->B and B<->C arrive at once and B holds no day", async () => {
      const [ana, miko] = [await participationOn(3), await participationOn(5)];
      const guest = await enrolGuest(2025, "Prima Lejana");

      for (let round = 0; round < ROUNDS; round++) {
        await raceSwaps(
          [ana.id, guest.id, miko.id],
          [
            [ana.id, guest.id],
            [guest.id, miko.id],
          ],
        );
      }
    });

    it("gives the day to one of them only when A<->B and B<->C arrive at once and only B holds a day", async () => {
      const sony = await participationOn(4);
      const [first, second] = await enrolGuests(2);

      for (let round = 0; round < ROUNDS; round++) {
        await raceSwaps(
          [first.id, sony.id, second.id],
          [
            [first.id, sony.id],
            [sony.id, second.id],
          ],
        );
      }
    });

    it("keeps the two days, one each, when the same two are swapped at once from both sides", async () => {
      const [ana, sony] = [await participationOn(3), await participationOn(4)];

      for (let round = 0; round < ROUNDS; round++) {
        await raceSwaps(
          [ana.id, sony.id],
          [
            [ana.id, sony.id],
            [sony.id, ana.id],
          ],
        );
      }
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

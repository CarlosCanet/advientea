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
  getEditionInfo,
  getParticipationsForEdition,
  placeParticipant,
  swapParticipants,
  unenrolParticipant,
  unplaceParticipant,
  upsertEdition,
} from "@/lib/dal";
import { ConflictError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

// The seed gives 2025 an active edition with five participants, each on a day: day 1 manager (with tea),
// day 2 guest "Anónimo" (with tea), days 3, 4 and 5 to ana, sony and miko. It has no other day row.
const beforeTheEdition = new Date("2025-11-15T12:00:00+01:00");
const duringTheEdition = new Date("2025-12-10T12:00:00+01:00");

async function day(dayNumber: number) {
  const found = await getDayByDayNumber({ dayNumber, year: 2025 });
  if (!found) {
    throw new Error(`2025 has no day ${dayNumber}`);
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
// within the calendar only exists once more people are enrolled, and its row once someone adds it.
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

// A row nobody holds, within the calendar or left over above it. The seed has none: placing someone
// creates the row of their day, so one that is already there is the trace of an earlier placement.
async function addFreeDay(dayNumber: number) {
  return prisma.day.create({ data: { dayNumber, year: 2025 } });
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
  const row = await addFreeDay(dayNumber);
  return prisma.participation.update({ data: { dayId: row.id }, where: { id: participationId } });
}

async function setEditionStatus(status: EditionStatus, year = 2025) {
  await prisma.edition.update({ data: { status }, where: { year } });
}

// A guess hangs from the day row, not from whoever holds it, so a row nobody holds can have one too.
async function addGuess(dayNumber: number, year = 2025) {
  const guesser = await prisma.user.findFirstOrThrow();
  const row = await prisma.day.findUniqueOrThrow({ where: { dayNumber_year: { dayNumber, year } } });
  return prisma.teaGuess.create({ data: { dayId: row.id, userId: guesser.id } });
}

/** The placements of 2025 together with every guess: what the refusal of a locked day must leave as it was. */
async function placementsAndGuesses() {
  return { ...(await placements()), guesses: await prisma.teaGuess.findMany({ orderBy: { id: "asc" } }) };
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
const dayHasGuesses = (dayNumber: number) => `El día ${dayNumber} ya tiene apuestas y no se puede cambiar.`;
const NO_LONGER_THERE = "Esa inscripción o ese día ya no existen.";
const NO_LONGER_ENROLLED = "Esa inscripción ya no existe.";
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
    const teaWithoutDay = {
      addMilk: false,
      canReinfuse: false,
      hasTheine: true,
      infusionTime: 3,
      name: "Sin día",
      temperature: 80,
    };

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

    it("gives each person the id and the number of the day row they hold, and nothing else of it", async () => {
      const held = await prisma.participation.findMany({
        select: { day: { select: { dayNumber: true, id: true } }, id: true },
        where: { year: 2025 },
      });

      const participations = await getParticipationsForEdition(2025);

      expect(participations).toHaveLength(5);
      for (const { day: row, id } of held) {
        expect(participations.find((participation) => participation.id === id)?.day).toEqual(row);
      }
      expect(participations.map((participation) => participation.day?.dayNumber).toSorted()).toEqual([1, 2, 3, 4, 5]);
      expect(participations.find((participation) => participation.guestName === "Anónimo")?.day).toEqual({
        dayNumber: 2,
        id: (await day(2)).id,
      });
    });

    it("follows the person to the row of the day they are moved to", async () => {
      const [guest] = await enrolGuests(1);
      const ana = await participationOn(3);
      const three = await day(3);
      await placeParticipant(ana.id, 6, beforeTheEdition);
      await placeParticipant(guest.id, 3, beforeTheEdition);

      const participations = await getParticipationsForEdition(2025);

      expect(participations.find((participation) => participation.id === ana.id)?.day).toEqual({
        dayNumber: 6,
        id: (await day(6)).id,
      });
      expect(participations.find((participation) => participation.id === guest.id)?.day).toEqual({
        dayNumber: 3,
        id: three.id,
      });
    });

    it("gives a null day to whoever holds none, enrolled without one or taken off theirs", async () => {
      const enrolled = await enrolGuest(2025, "Prima Lejana");
      const ana = await participationOn(3);
      await unplaceParticipant(ana.id, beforeTheEdition);

      const participations = await getParticipationsForEdition(2025);

      const withoutDay = participations.filter((participation) => participation.day === null);
      expect(withoutDay.map((participation) => participation.id).toSorted()).toEqual([ana.id, enrolled.id].toSorted());
    });

    it("says who has a tea, with or without a day", async () => {
      const enrolled = await enrolGuest(2025, "Prima Lejana");
      await addTea(teaWithoutDay, [], enrolled.id);

      const participations = await getParticipationsForEdition(2025);

      const withTea = participations.filter((participation) => participation.tea !== null);
      expect(withTea.map((participation) => participation.day?.dayNumber ?? null).toSorted()).toEqual([1, 2, null]);
    });

    it("gives the id and the name of the tea of whoever has one, and nothing else of it", async () => {
      const enrolled = await enrolGuest(2025, "Prima Lejana");
      const added = await addTea(teaWithoutDay, [], enrolled.id);
      const manager = await participationOn(1);
      const guest = await participationOn(2);
      const teaOf = async (participationId: string) =>
        prisma.tea.findUniqueOrThrow({ select: { id: true, name: true }, where: { participationId } });

      const participations = await getParticipationsForEdition(2025);

      const found = (id: string) => participations.find((participation) => participation.id === id);
      expect(found(manager.id)?.tea).toEqual({ id: (await teaOf(manager.id)).id, name: "Ruta del desierto" });
      expect(found(guest.id)?.tea).toEqual({ id: (await teaOf(guest.id)).id, name: "Pakistaní" });
      expect(found(enrolled.id)?.tea).toEqual({ id: added.id, name: "Sin día" });
      expect(found(enrolled.id)?.day).toBeNull();
    });

    it("gives a null tea to whoever has none, with or without a day", async () => {
      const enrolled = await enrolGuest(2025, "Prima Lejana");

      const participations = await getParticipationsForEdition(2025);

      const withoutTea = participations.filter((participation) => participation.tea === null);
      expect(withoutTea.map((participation) => participation.day?.dayNumber ?? null).toSorted()).toEqual([
        3,
        4,
        5,
        null,
      ]);
      expect(participations.find((participation) => participation.id === enrolled.id)).toMatchObject({
        day: null,
        tea: null,
      });
    });

    it("never loads the guest token or anything of the account but the username", async () => {
      await enrolGuest(2025, "Prima Lejana");

      const participations = await getParticipationsForEdition(2025);

      for (const participation of participations) {
        expect(participation).not.toHaveProperty("guestToken");
        expect(participation).not.toHaveProperty("email");
        if (participation.user) {
          expect(Object.keys(participation.user)).toEqual(["username"]);
        }
      }
    });

    it("carries no guest token and no email anywhere in what it returns", async () => {
      const enrolled = await enrolGuest(2025, "Prima Lejana");
      const anonymous = await participationOn(2);
      // Whether enrolling hands out a token or not, these two guests have one the payload could leak.
      await prisma.participation.update({ data: { guestToken: "token-of-anonymous" }, where: { id: anonymous.id } });
      await prisma.participation.update({ data: { guestToken: "token-of-the-cousin" }, where: { id: enrolled.id } });
      const users = await prisma.user.findMany({ select: { email: true } });
      const tokens = await prisma.participation.findMany({
        select: { guestToken: true },
        where: { guestToken: { not: null } },
      });

      const participations = await getParticipationsForEdition(2025);

      const payload = JSON.stringify(participations);
      expect(users).toHaveLength(5);
      expect(tokens.length).toBeGreaterThanOrEqual(2);
      for (const { email } of users) {
        expect(payload).not.toContain(email);
      }
      for (const { guestToken } of tokens) {
        expect(payload).not.toContain(guestToken);
      }
      expect(payload).not.toContain("guestToken");
      expect(payload).not.toContain("email");
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
      const free = await addFreeDay(6);

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
      const free = await addFreeDay(7);

      await expect(assignDay(free.id, { userId: ana.userId! }, beforeTheEdition)).rejects.toThrow(/el día 3/);
      expect((await prisma.participation.findUniqueOrThrow({ where: { id: ana.id } })).dayId).toBe(ana.dayId);
    });

    it("gives the day to a user enrolled without one, reusing their participation", async () => {
      const user = await userWithoutDay();
      const enrolled = await prisma.participation.create({
        data: { edition: { connect: { year: 2025 } }, user: { connect: { id: user.id } } },
      });
      const free = await addFreeDay(8);

      const result = await assignDay(free.id, { userId: user.id }, beforeTheEdition);

      expect(result.id).toBe(enrolled.id);
      expect(result.dayId).toBe(free.id);
    });

    it("creates a guest participation on a free day", async () => {
      const free = await addFreeDay(9);

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
      const past = await addFreeDay(7);

      await expect(assignDay(past.id, { userId: user.id }, duringTheEdition)).rejects.toThrow(/ya ha pasado o es hoy/);
    });

    it("rejects an unknown day as invalid input, not as a conflict", async () => {
      await expect(assignDay("no-such-day", { guestName: "Nadie" }, beforeTheEdition)).rejects.toThrow(
        /does not exist/,
      );
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
      const six = await addFreeDay(6);
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
      const six = await addFreeDay(6);

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
      const rows = await prisma.day.count();

      const result = await placeParticipant(guest.id, 6, beforeTheEdition);

      expect(result.day).toMatchObject({ dayNumber: 6, year: 2025 });
      expect(await prisma.day.count()).toBe(rows + 1);
      const created = await day(6);
      expect(result.dayId).toBe(created.id);
      expect((await prisma.participation.findUniqueOrThrow({ where: { id: guest.id } })).dayId).toBe(created.id);
    });

    it("creates only the row asked for, not the missing ones below it", async () => {
      const [guest] = await enrolGuests(3);
      const before = await placements();

      await placeParticipant(guest.id, 8, beforeTheEdition);

      const after = await placements();
      expect(after.days.map((item) => item.dayNumber)).toEqual(
        [...before.days.map((item) => item.dayNumber), 8].toSorted((a, b) => a - b),
      );
    });

    it("accepts a number it refused once one more person is enrolled", async () => {
      const [guest] = await enrolGuests(1);
      await addFreeDay(7);
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
      await addFreeDay(dayNumber);
      const before = await placements();

      await expect(placeParticipant(guest.id, dayNumber, beforeTheEdition)).rejects.toThrow(ConflictError);
      await expect(placeParticipant(guest.id, dayNumber, beforeTheEdition)).rejects.toThrow(
        new ConflictError("La edición 2025 tiene 6 participantes: elige un día entre 1 y 6."),
      );
      expect(await placements()).toEqual(before);
    });

    it("refuses to move someone to a leftover row above the number of participants: they keep their day", async () => {
      const ana = await participationOn(3);
      await addFreeDay(6);
      const before = await placements();

      await expect(placeParticipant(ana.id, 6, beforeTheEdition)).rejects.toThrow(
        new ConflictError("La edición 2025 tiene 5 participantes: elige un día entre 1 y 5."),
      );
      expect(await placements()).toEqual(before);
      expect((await participationOn(3)).id).toBe(ana.id);
    });

    it("moves someone off a leftover day above the calendar to a free day within it", async () => {
      const twenty = await addFreeDay(20);
      const stray = await prisma.participation.create({
        data: { dayId: twenty.id, guestName: "Prima Lejana", year: 2025 },
      });
      await addFreeDay(6);

      const result = await placeParticipant(stray.id, 6, beforeTheEdition);

      expect(result.id).toBe(stray.id);
      expect(result.day?.dayNumber).toBe(6);
      expect((await participationOn(6)).id).toBe(stray.id);
      expect(await prisma.day.findUnique({ where: { id: twenty.id } })).not.toBeNull();
      expect(await prisma.participation.findUnique({ where: { dayId: twenty.id } })).toBeNull();
    });

    it("changes nothing when asked for the leftover day above the calendar the person already holds", async () => {
      const twenty = await addFreeDay(20);
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
      const six = await addFreeDay(6);

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
      const ana = await participationOn(3);

      const result = await placeParticipant(ana.id, 6, beforeTheEdition);

      expect(result.day).toMatchObject({ dayNumber: 6, year: 2025 });
      expect((await participationOn(6)).id).toBe(ana.id);
      expect(await prisma.day.findUnique({ where: { id: ana.dayId! } })).not.toBeNull();
      expect(await prisma.participation.findUnique({ where: { dayId: ana.dayId! } })).toBeNull();
    });

    it("moves someone with a tea and leaves the tea row exactly as it was", async () => {
      await enrolGuests(1);
      await addFreeDay(6);
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
      await addFreeDay(6);
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
      await addFreeDay(dayNumber);
      const before = await placements();

      await expect(placeParticipant(guest.id, dayNumber, duringTheEdition)).rejects.toThrow(ConflictError);
      await expect(placeParticipant(guest.id, dayNumber, duringTheEdition)).rejects.not.toThrow(/participantes/);
      expect(await placements()).toEqual(before);
    });

    it("refuses to move someone whose own day has opened, even to a day that has not", async () => {
      await enrolGuests(10);
      await addFreeDay(15);
      const ana = await participationOn(3);
      const before = await placements();

      await expect(placeParticipant(ana.id, 15, duringTheEdition)).rejects.toThrow(ConflictError);
      await expect(placeParticipant(ana.id, 15, duringTheEdition)).rejects.not.toThrow(/participantes/);
      expect(await placements()).toEqual(before);
    });

    it("refuses to move someone whose own day has opened to a day without a row, and does not create it", async () => {
      await enrolGuests(10);
      const ana = await participationOn(3);
      const before = await placements();

      await expect(placeParticipant(ana.id, 15, duringTheEdition)).rejects.toThrow(ConflictError);
      await expect(placeParticipant(ana.id, 15, duringTheEdition)).rejects.not.toThrow(/participantes/);
      expect(await placements()).toEqual(before);
    });

    it("refuses to move someone from a day that has not opened to one that has", async () => {
      const [late] = await enrolGuests(7);
      await putOnDay(late.id, 12);
      await addFreeDay(6);
      const before = await placements();

      await expect(placeParticipant(late.id, 6, duringTheEdition)).rejects.toThrow(ConflictError);
      await expect(placeParticipant(late.id, 6, duringTheEdition)).rejects.not.toThrow(/participantes/);
      expect(await placements()).toEqual(before);
    });

    it("refuses to create the row of a day whose date has already passed", async () => {
      const [guest] = await enrolGuests(3);
      const before = await placements();

      await expect(placeParticipant(guest.id, 8, duringTheEdition)).rejects.toThrow(ConflictError);
      await expect(placeParticipant(guest.id, 8, duringTheEdition)).rejects.not.toThrow(/participantes/);
      expect(await placements()).toEqual(before);
    });

    it("places someone on a day that has not opened while the edition is running", async () => {
      const [guest] = await enrolGuests(6);
      await addFreeDay(11);

      const result = await placeParticipant(guest.id, 11, duringTheEdition);

      expect(result.day?.dayNumber).toBe(11);
      expect((await participationOn(11)).id).toBe(guest.id);
    });

    it("moves someone between two days that have not opened while the edition is running", async () => {
      const [late] = await enrolGuests(8);
      const twelve = await addFreeDay(12);
      await prisma.participation.update({ data: { dayId: twelve.id }, where: { id: late.id } });
      await addFreeDay(13);

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
      await addFreeDay(7);

      await expect(placeParticipant(ghost.id, 3, beforeTheEdition)).rejects.toThrow(
        new ConflictError("La edición 2030 tiene 2 participantes: elige un día entre 1 y 2."),
      );
      await expect(placeParticipant(guest.id, 7, beforeTheEdition)).rejects.toThrow(
        new ConflictError("La edición 2025 tiene 6 participantes: elige un día entre 1 y 6."),
      );
      expect(await prisma.day.count({ where: { year: 2030 } })).toBe(0);
    });

    it("refuses an unknown participation as a conflict: it no longer exists", async () => {
      const before = await placements();
      const dayRows = await prisma.day.count();

      await expectConflict(placeParticipant("no-such-participation", 1, beforeTheEdition), NO_LONGER_ENROLLED);
      await expectConflict(placeParticipant("no-such-participation", 26, beforeTheEdition), NO_LONGER_ENROLLED);
      expect(await placements()).toEqual(before);
      expect(await prisma.day.count()).toBe(dayRows);
    });

    it("refuses someone who has just been removed the same way, and creates no day for them", async () => {
      const [guest] = await enrolGuests(2);
      await prisma.participation.delete({ where: { id: guest.id } });
      const before = await placements();

      await expectConflict(placeParticipant(guest.id, 6, beforeTheEdition), NO_LONGER_ENROLLED);
      expect(await placements()).toEqual(before);
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
      const six = await addFreeDay(6);
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
      await addFreeDay(6);
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
      await addFreeDay(6);
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
        await addFreeDay(6);
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
      await addFreeDay(6);
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
      if (rowExists) {
        await addFreeDay(6);
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

    describe("a day with guesses is locked", () => {
      it.each([
        { rowExists: true, target: "a free day" },
        { rowExists: false, target: "a day without a row, which is not created" },
      ])(
        "refuses to move someone off a day with a guess to $target, in an edition in preparation",
        async ({ rowExists }) => {
          await setEditionStatus(EditionStatus.PREPARING);
          await enrolGuests(1);
          if (rowExists) {
            await addFreeDay(6);
          }
          const ana = await participationOn(3);
          await addGuess(3);
          const before = await placementsAndGuesses();

          await expectConflict(placeParticipant(ana.id, 6, duringTheEdition), dayHasGuesses(3));
          expect(await placementsAndGuesses()).toEqual(before);
          expect((await participationOn(3)).id).toBe(ana.id);
        },
      );

      it("refuses a row nobody holds that has guesses to someone without a day", async () => {
        await setEditionStatus(EditionStatus.PREPARING);
        const [guest] = await enrolGuests(1);
        await addFreeDay(6);
        await addGuess(6);
        const before = await placementsAndGuesses();

        await expectConflict(placeParticipant(guest.id, 6, duringTheEdition), dayHasGuesses(6));
        expect(await placementsAndGuesses()).toEqual(before);
        expect((await prisma.participation.findUniqueOrThrow({ where: { id: guest.id } })).dayId).toBeNull();
      });

      it("refuses to move someone from a day without guesses onto a free row that has them", async () => {
        await setEditionStatus(EditionStatus.PREPARING);
        await enrolGuests(1);
        await addFreeDay(6);
        await addGuess(6);
        const ana = await participationOn(3);
        const before = await placementsAndGuesses();

        await expectConflict(placeParticipant(ana.id, 6, duringTheEdition), dayHasGuesses(6));
        expect(await placementsAndGuesses()).toEqual(before);
        expect((await participationOn(3)).id).toBe(ana.id);
      });

      it("says that a held day has guesses before saying who holds it", async () => {
        await setEditionStatus(EditionStatus.PREPARING);
        const [guest] = await enrolGuests(1);
        await addGuess(4);
        const before = await placementsAndGuesses();

        await expectConflict(placeParticipant(guest.id, 4, duringTheEdition), dayHasGuesses(4));
        expect(await placementsAndGuesses()).toEqual(before);
      });

      it("names the person's own day, not the target, when both have guesses", async () => {
        await setEditionStatus(EditionStatus.PREPARING);
        await enrolGuests(1);
        await addFreeDay(6);
        await addGuess(6);
        await addGuess(3);
        const ana = await participationOn(3);
        const before = await placementsAndGuesses();

        await expectConflict(placeParticipant(ana.id, 6, duringTheEdition), dayHasGuesses(3));
        expect(await placementsAndGuesses()).toEqual(before);
      });

      it("looks at the guesses of the person's own day before the range of the calendar", async () => {
        await setEditionStatus(EditionStatus.PREPARING);
        const ana = await participationOn(3);
        await addGuess(3);
        const before = await placementsAndGuesses();

        await expectConflict(placeParticipant(ana.id, 26, duringTheEdition), dayHasGuesses(3));
        expect(await placementsAndGuesses()).toEqual(before);
      });

      it("looks at the range of the calendar before the guesses of the target", async () => {
        await setEditionStatus(EditionStatus.PREPARING);
        const [guest] = await enrolGuests(1);
        await addFreeDay(7);
        await addGuess(7);
        const before = await placementsAndGuesses();

        await expectConflict(
          placeParticipant(guest.id, 7, duringTheEdition),
          "La edición 2025 tiene 6 participantes: elige un día entre 1 y 6.",
        );
        expect(await placementsAndGuesses()).toEqual(before);
      });

      it.each([
        { now: duringTheEdition, status: EditionStatus.PREPARING, when: "in an edition in preparation" },
        { now: beforeTheEdition, status: EditionStatus.ACTIVE, when: "in an active edition before its date" },
        { now: duringTheEdition, status: EditionStatus.ACTIVE, when: "once it has also opened" },
      ])(
        "still accepts the day the person already holds when it has guesses, $when, since nothing changes",
        async ({ now, status }) => {
          await setEditionStatus(status);
          const ana = await participationOn(3);
          await addGuess(3);
          const before = await placementsAndGuesses();

          const result = await placeParticipant(ana.id, 3, now);

          expect(result.id).toBe(ana.id);
          expect(result.dayId).toBe(ana.dayId);
          expect(result.day?.dayNumber).toBe(3);
          expect(await placementsAndGuesses()).toEqual(before);
        },
      );

      it("refuses to move someone off a day with a guess in an active edition before the day's date", async () => {
        await enrolGuests(1);
        await addFreeDay(6);
        const ana = await participationOn(3);
        await addGuess(3);
        const before = await placementsAndGuesses();

        await expectConflict(placeParticipant(ana.id, 6, beforeTheEdition), dayHasGuesses(3));
        expect(await placementsAndGuesses()).toEqual(before);
      });

      it("refuses a free row with guesses in an active edition before the day's date", async () => {
        const [guest] = await enrolGuests(1);
        await addFreeDay(6);
        await addGuess(6);
        const before = await placementsAndGuesses();

        await expectConflict(placeParticipant(guest.id, 6, beforeTheEdition), dayHasGuesses(6));
        expect(await placementsAndGuesses()).toEqual(before);
      });

      it("keeps the message of a day that has opened when that day also has guesses", async () => {
        const [guest] = await enrolGuests(10);
        await addFreeDay(7);
        await addFreeDay(15);
        await addGuess(7);
        await addGuess(3);
        const ana = await participationOn(3);
        const before = await placementsAndGuesses();

        // Day 3 is the person's own and day 7 the target: both opened before 10 December.
        await expectConflict(placeParticipant(ana.id, 15, duringTheEdition), DAY_HAS_OPENED);
        await expectConflict(placeParticipant(guest.id, 7, duringTheEdition), DAY_HAS_OPENED);
        expect(await placementsAndGuesses()).toEqual(before);
      });

      it.each([
        { now: duringTheEdition, status: EditionStatus.PREPARING, when: "an edition in preparation" },
        { now: beforeTheEdition, status: EditionStatus.ACTIVE, when: "an active edition before its dates" },
      ])("moves a day without guesses freely while another day of $when has them", async ({ now, status }) => {
        await setEditionStatus(status);
        const [guest] = await enrolGuests(2);
        await addGuess(3);
        const sony = await participationOn(4);
        const before = await placementsAndGuesses();

        const moved = await placeParticipant(sony.id, 6, now);
        const placed = await placeParticipant(guest.id, 4, now);

        expect(moved.day?.dayNumber).toBe(6);
        expect(placed.day?.dayNumber).toBe(4);
        expect((await participationOn(6)).id).toBe(sony.id);
        expect((await participationOn(4)).id).toBe(guest.id);
        const after = await placementsAndGuesses();
        expect(after.guesses).toEqual(before.guesses);
        expect(after.participations).toEqual(
          withDays(before, { [guest.id]: sony.dayId, [sony.id]: (await day(6)).id }),
        );
      });
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

    it("refuses an unknown participation as a conflict: it no longer exists", async () => {
      const before = await placements();

      await expectConflict(unplaceParticipant("no-such-participation", beforeTheEdition), NO_LONGER_ENROLLED);
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

    describe("a day with guesses is locked", () => {
      it.each([
        { now: duringTheEdition, status: EditionStatus.PREPARING, when: "in an edition in preparation" },
        { now: beforeTheEdition, status: EditionStatus.ACTIVE, when: "in an active edition before the day's date" },
      ])("refuses someone whose day has a guess $when, who keeps it", async ({ now, status }) => {
        await setEditionStatus(status);
        const ana = await participationOn(3);
        await addGuess(3);
        const before = await placementsAndGuesses();

        await expectConflict(unplaceParticipant(ana.id, now), dayHasGuesses(3));
        expect(await placementsAndGuesses()).toEqual(before);
        expect((await participationOn(3)).id).toBe(ana.id);
      });

      it("refuses a guest the same way and names the number of their day", async () => {
        await setEditionStatus(EditionStatus.PREPARING);
        const guest = await participationOn(2);
        await addGuess(2);
        const before = await placementsAndGuesses();

        await expectConflict(unplaceParticipant(guest.id, beforeTheEdition), dayHasGuesses(2));
        expect(await placementsAndGuesses()).toEqual(before);
      });

      it("keeps the message of a day that has opened when that day also has guesses", async () => {
        const ana = await participationOn(3);
        await addGuess(3);
        const before = await placementsAndGuesses();

        await expectConflict(unplaceParticipant(ana.id, duringTheEdition), DAY_HAS_OPENED);
        expect(await placementsAndGuesses()).toEqual(before);
      });

      it.each([
        { now: duringTheEdition, status: EditionStatus.PREPARING, when: "an edition in preparation" },
        { now: beforeTheEdition, status: EditionStatus.ACTIVE, when: "an active edition before its dates" },
      ])("frees a day without guesses while another day of $when has them", async ({ now, status }) => {
        await setEditionStatus(status);
        await addGuess(3);
        const sony = await participationOn(4);
        const before = await placementsAndGuesses();

        const result = await unplaceParticipant(sony.id, now);

        expect(result).toMatchObject({ day: null, dayId: null, id: sony.id });
        const after = await placementsAndGuesses();
        expect(after.days).toEqual(before.days);
        expect(after.guesses).toEqual(before.guesses);
        expect(after.participations).toEqual(withDays(before, { [sony.id]: null }));
      });

      it("resolves with the participation as it was for someone without a day, whatever the guesses around", async () => {
        await setEditionStatus(EditionStatus.PREPARING);
        const guest = await enrolGuest(2025, "Prima Lejana");
        await addGuess(3);
        const before = await placementsAndGuesses();

        const result = await unplaceParticipant(guest.id, beforeTheEdition);

        expect(result).toMatchObject({ day: null, dayId: null, id: guest.id });
        expect(await placementsAndGuesses()).toEqual(before);
      });
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

    it("refuses an unknown participation as a conflict, whichever of the two it is", async () => {
      const ana = await participationOn(3);
      const guest = await enrolGuest(2025, "Prima Lejana");
      const before = await placements();

      await expectConflict(swapParticipants("no-such-participation", ana.id, beforeTheEdition), NO_LONGER_ENROLLED);
      await expectConflict(swapParticipants(ana.id, "no-such-participation", beforeTheEdition), NO_LONGER_ENROLLED);
      await expectConflict(swapParticipants("no-such-participation", guest.id, beforeTheEdition), NO_LONGER_ENROLLED);
      await expectConflict(swapParticipants(guest.id, "no-such-participation", beforeTheEdition), NO_LONGER_ENROLLED);
      await expectConflict(swapParticipants("gone-first", "gone-second", beforeTheEdition), NO_LONGER_ENROLLED);
      expect(await placements()).toEqual(before);
    });

    it("refuses to swap with someone who has just been removed: the other one keeps their day", async () => {
      const ana = await participationOn(3);
      const guest = await enrolGuest(2025, "Prima Lejana");
      await prisma.participation.delete({ where: { id: guest.id } });
      const before = await placements();

      await expectConflict(swapParticipants(ana.id, guest.id, beforeTheEdition), NO_LONGER_ENROLLED);
      await expectConflict(swapParticipants(guest.id, ana.id, beforeTheEdition), NO_LONGER_ENROLLED);
      expect(await placements()).toEqual(before);
      expect((await participationOn(3)).id).toBe(ana.id);
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

    describe("a day with guesses is locked", () => {
      it.each([{ locked: "first" }, { locked: "second" }])(
        "refuses when the day of the $locked of the two has a guess, in an edition in preparation",
        async ({ locked }) => {
          await setEditionStatus(EditionStatus.PREPARING);
          const ana = await participationOn(3);
          const sony = await participationOn(4);
          await addGuess(3);
          const before = await placementsAndGuesses();

          await expectConflict(
            locked === "first"
              ? swapParticipants(ana.id, sony.id, duringTheEdition)
              : swapParticipants(sony.id, ana.id, duringTheEdition),
            dayHasGuesses(3),
          );
          expect(await placementsAndGuesses()).toEqual(before);
        },
      );

      it.each([{ holder: "first" }, { holder: "second" }])(
        "refuses to pass on a day with a guess to someone without one (held by the $holder)",
        async ({ holder }) => {
          await setEditionStatus(EditionStatus.PREPARING);
          const ana = await participationOn(3);
          const guest = await enrolGuest(2025, "Prima Lejana");
          await addGuess(3);
          const before = await placementsAndGuesses();

          await expectConflict(
            holder === "first"
              ? swapParticipants(ana.id, guest.id, duringTheEdition)
              : swapParticipants(guest.id, ana.id, duringTheEdition),
            dayHasGuesses(3),
          );
          expect(await placementsAndGuesses()).toEqual(before);
          expect((await prisma.participation.findUniqueOrThrow({ where: { id: guest.id } })).dayId).toBeNull();
        },
      );

      it("refuses when both days have guesses, naming one of the two", async () => {
        await setEditionStatus(EditionStatus.PREPARING);
        const ana = await participationOn(3);
        const sony = await participationOn(4);
        await addGuess(3);
        await addGuess(4);
        const before = await placementsAndGuesses();

        const error: unknown = await swapParticipants(ana.id, sony.id, duringTheEdition).catch(
          (reason: unknown) => reason,
        );

        expect(error).toBeInstanceOf(ConflictError);
        expect([dayHasGuesses(3), dayHasGuesses(4)]).toContain((error as ConflictError).message);
        expect(await placementsAndGuesses()).toEqual(before);
      });

      it("refuses a day with a guess in an active edition before the day's date, from either side", async () => {
        const ana = await participationOn(3);
        const sony = await participationOn(4);
        const guest = await enrolGuest(2025, "Prima Lejana");
        await addGuess(4);
        const before = await placementsAndGuesses();

        await expectConflict(swapParticipants(ana.id, sony.id, beforeTheEdition), dayHasGuesses(4));
        await expectConflict(swapParticipants(sony.id, ana.id, beforeTheEdition), dayHasGuesses(4));
        await expectConflict(swapParticipants(sony.id, guest.id, beforeTheEdition), dayHasGuesses(4));
        await expectConflict(swapParticipants(guest.id, sony.id, beforeTheEdition), dayHasGuesses(4));
        expect(await placementsAndGuesses()).toEqual(before);
      });

      it("keeps the message of a day that has opened when that day also has guesses", async () => {
        const ana = await participationOn(3);
        const [late] = await enrolGuests(7);
        await putOnDay(late.id, 12);
        await addGuess(3);
        const before = await placementsAndGuesses();

        // Day 12 has neither opened nor guesses on 10 December: the only locked day is the third.
        await expectConflict(swapParticipants(ana.id, late.id, duringTheEdition), DAY_HAS_OPENED);
        await expectConflict(swapParticipants(late.id, ana.id, duringTheEdition), DAY_HAS_OPENED);
        expect(await placementsAndGuesses()).toEqual(before);
      });

      it.each([
        { now: duringTheEdition, status: EditionStatus.PREPARING, when: "an edition in preparation" },
        { now: beforeTheEdition, status: EditionStatus.ACTIVE, when: "an active edition before its dates" },
      ])("swaps two days without guesses while another day of $when has them", async ({ now, status }) => {
        await setEditionStatus(status);
        const ana = await participationOn(3);
        const sony = await participationOn(4);
        await addGuess(5);
        const before = await placementsAndGuesses();

        const result = await swapParticipants(ana.id, sony.id, now);

        expect(result[0].day?.dayNumber).toBe(4);
        expect(result[1].day?.dayNumber).toBe(3);
        const after = await placementsAndGuesses();
        expect(after.days).toEqual(before.days);
        expect(after.guesses).toEqual(before.guesses);
        expect(after.participations).toEqual(withDays(before, { [ana.id]: sony.dayId, [sony.id]: ana.dayId }));
      });

      it("resolves with both as they were when neither holds a day, whatever the guesses around", async () => {
        await setEditionStatus(EditionStatus.PREPARING);
        const [first, second] = await enrolGuests(2);
        await addGuess(3);
        const before = await placementsAndGuesses();

        const result = await swapParticipants(first.id, second.id, beforeTheEdition);

        expect(result[0]).toMatchObject({ day: null, dayId: null, id: first.id });
        expect(result[1]).toMatchObject({ day: null, dayId: null, id: second.id });
        expect(await placementsAndGuesses()).toEqual(before);
      });
    });
  });

  describe("unenrolParticipant", () => {
    const ENROLMENT_JUST_CHANGED = "Esa inscripción acaba de cambiar. Recarga la página y vuelve a intentarlo.";
    const EDITION_ARCHIVED = "La edición 2025 está archivada.";
    const holdsOpenedDay = (name: string, dayNumber: number) =>
      `${name} tiene el día ${dayNumber}, que ya ha pasado o es hoy: su inscripción no se puede quitar.`;
    const holdsDayWithGuesses = (name: string, dayNumber: number) =>
      `${name} tiene el día ${dayNumber}, que ya tiene apuestas: su inscripción no se puede quitar.`;
    const teaAlreadyUploaded = (name: string) => `${name} ya ha subido su té. Recarga la página y vuelve a intentarlo.`;

    const teaData = {
      addMilk: false,
      canReinfuse: false,
      hasTheine: true,
      infusionTime: 3,
      name: "Té de prueba",
      temperature: 80,
    };

    // Who wins a race is a matter of timing, so each one is run a few times, with someone new every time.
    const ROUNDS = 5;

    /** Every row an unenrolment could reach, whole: what a refusal must leave as it was. */
    async function everything() {
      const [days, guesses, images, participations, stories, teas, users] = await Promise.all([
        prisma.day.findMany({ orderBy: { id: "asc" } }),
        prisma.teaGuess.findMany({ orderBy: { id: "asc" } }),
        prisma.storyImage.findMany({ orderBy: { id: "asc" } }),
        prisma.participation.findMany({ orderBy: { id: "asc" } }),
        prisma.storyTea.findMany({ orderBy: { id: "asc" } }),
        prisma.tea.findMany({ include: { ingredients: { orderBy: { id: "asc" } } }, orderBy: { id: "asc" } }),
        prisma.user.findMany({ orderBy: { id: "asc" } }),
      ]);
      return { days, guesses, images, participations, stories, teas, users };
    }

    type Everything = Awaited<ReturnType<typeof everything>>;

    /** `before` once the participation is gone, with its tea, story and images when it had them, and nothing else. */
    function without(before: Everything, participationId: string): Everything {
      const teaIds = before.teas.filter((tea) => tea.participationId === participationId).map((tea) => tea.id);
      const storyIds = before.stories.filter((story) => teaIds.includes(story.teaId)).map((story) => story.id);
      return {
        ...before,
        images: before.images.filter((image) => !storyIds.includes(image.storyTeaId)),
        participations: before.participations.filter((participation) => participation.id !== participationId),
        stories: before.stories.filter((story) => !storyIds.includes(story.id)),
        teas: before.teas.filter((tea) => !teaIds.includes(tea.id)),
      };
    }

    // A race may go through a day row without changing which day it is, so rows are compared by what they are.
    function dayRows(from: Everything) {
      return from.days.map(({ dayNumber, id, year }) => ({ dayNumber, id, year }));
    }

    async function teaWithStoryOf(participationId: string) {
      return prisma.tea.findUniqueOrThrow({
        include: { story: { include: { images: true } } },
        where: { participationId },
      });
    }

    function expectFulfilledOrConflict(result: PromiseSettledResult<unknown>) {
      if (result.status === "rejected") {
        expect(result.reason).toBeInstanceOf(ConflictError);
      }
    }

    // A simulated failure that the call never reaches would otherwise break the reset of the next test.
    afterEach(() => {
      vi.restoreAllMocks();
    });

    describe("refusals", () => {
      it("refuses an unknown participation as a conflict, whatever is said about the tea", async () => {
        const before = await everything();

        await expectConflict(
          unenrolParticipant("no-such-participation", { deleteTea: false }, beforeTheEdition),
          NO_LONGER_ENROLLED,
        );
        await expectConflict(
          unenrolParticipant("no-such-participation", { deleteTea: true }, beforeTheEdition),
          NO_LONGER_ENROLLED,
        );
        expect(await everything()).toEqual(before);
      });

      it("refuses everyone of an archived edition: with a day, with a tea or with neither", async () => {
        const manager = await participationOn(1);
        const ana = await participationOn(3);
        const guest = await enrolGuest(2025, "Prima Lejana");
        await setEditionStatus(EditionStatus.ARCHIVED);
        const before = await everything();

        await expectConflict(unenrolParticipant(guest.id, { deleteTea: false }, beforeTheEdition), EDITION_ARCHIVED);
        await expectConflict(unenrolParticipant(ana.id, { deleteTea: false }, beforeTheEdition), EDITION_ARCHIVED);
        await expectConflict(unenrolParticipant(manager.id, { deleteTea: true }, beforeTheEdition), EDITION_ARCHIVED);
        expect(await everything()).toEqual(before);
      });

      it("says that the edition is archived before anything about the day, its guesses or the tea", async () => {
        const manager = await participationOn(1);
        await addGuess(1);
        await setEditionStatus(EditionStatus.ARCHIVED);
        const before = await everything();

        // Every day of an archived edition has opened, this one has a guess and the tea is not to be deleted.
        await expectConflict(unenrolParticipant(manager.id, { deleteTea: false }, duringTheEdition), EDITION_ARCHIVED);
        expect(await everything()).toEqual(before);
      });

      it("names the year of the participation's own edition, and only that one counts", async () => {
        await upsertEdition(2030, EditionStatus.PREPARING);
        const [ghost] = await enrolGuests(1, 2030);
        await setEditionStatus(EditionStatus.ARCHIVED, 2030);
        const guest = await enrolGuest(2025, "Prima Lejana");
        const before = await everything();

        await expectConflict(
          unenrolParticipant(ghost.id, { deleteTea: false }, beforeTheEdition),
          "La edición 2030 está archivada.",
        );
        expect(await everything()).toEqual(before);

        await unenrolParticipant(guest.id, { deleteTea: false }, beforeTheEdition);

        expect(await everything()).toEqual(without(before, guest.id));
      });

      it.each([
        { dayNumber: 3, name: "Ñita", who: "an account" },
        { dayNumber: 2, name: "Anónimo", who: "a guest" },
      ])("refuses $who whose day has opened and names them and the day", async ({ dayNumber, name }) => {
        const holder = await participationOn(dayNumber);
        const before = await everything();

        await expectConflict(
          unenrolParticipant(holder.id, { deleteTea: true }, duringTheEdition),
          holdsOpenedDay(name, dayNumber),
        );
        expect(await everything()).toEqual(before);
      });

      it("calls the holder of an opened day 'Esa persona' when their account was deleted", async () => {
        const ana = await participationOn(3);
        await prisma.user.delete({ where: { id: ana.userId! } });
        const before = await everything();

        await expectConflict(
          unenrolParticipant(ana.id, { deleteTea: false }, duringTheEdition),
          holdsOpenedDay("Esa persona", 3),
        );
        expect(await everything()).toEqual(before);
      });

      it("refuses whoever holds the day that opens today and removes whoever holds tomorrow's", async () => {
        const [today, tomorrow] = await enrolGuests(2);
        await putOnDay(today.id, 10);
        await putOnDay(tomorrow.id, 11);
        const before = await everything();

        await expectConflict(
          unenrolParticipant(today.id, { deleteTea: false }, duringTheEdition),
          holdsOpenedDay("Invitada 1", 10),
        );
        expect(await everything()).toEqual(before);

        const result = await unenrolParticipant(tomorrow.id, { deleteTea: false }, duringTheEdition);

        expect(result.participation.id).toBe(tomorrow.id);
        expect(result.participation.day?.dayNumber).toBe(11);
        expect(await everything()).toEqual(without(before, tomorrow.id));
      });

      it("says that the day has opened before anything about its guesses or the tea", async () => {
        const manager = await participationOn(1);
        await addGuess(1);
        const before = await everything();

        await expectConflict(
          unenrolParticipant(manager.id, { deleteTea: false }, duringTheEdition),
          holdsOpenedDay("Deinos", 1),
        );
        await expectConflict(
          unenrolParticipant(manager.id, { deleteTea: true }, duringTheEdition),
          holdsOpenedDay("Deinos", 1),
        );
        expect(await everything()).toEqual(before);
      });

      it.each([
        { now: duringTheEdition, status: EditionStatus.PREPARING, when: "in an edition in preparation" },
        { now: beforeTheEdition, status: EditionStatus.ACTIVE, when: "in an active edition before the day's date" },
      ])("refuses someone whose day has not opened but has guesses, $when", async ({ now, status }) => {
        await setEditionStatus(status);
        const ana = await participationOn(3);
        await addGuess(3);
        const before = await everything();

        await expectConflict(unenrolParticipant(ana.id, { deleteTea: false }, now), holdsDayWithGuesses("Ñita", 3));
        await expectConflict(unenrolParticipant(ana.id, { deleteTea: true }, now), holdsDayWithGuesses("Ñita", 3));
        expect(await everything()).toEqual(before);
      });

      it("refuses a guest whose day has guesses and names them and the day", async () => {
        const guest = await participationOn(2);
        await addGuess(2);
        const before = await everything();

        await expectConflict(
          unenrolParticipant(guest.id, { deleteTea: true }, beforeTheEdition),
          holdsDayWithGuesses("Anónimo", 2),
        );
        expect(await everything()).toEqual(before);
      });

      it("calls the holder of a day with guesses 'Esa persona' when their account was deleted", async () => {
        const ana = await participationOn(3);
        await prisma.user.delete({ where: { id: ana.userId! } });
        // The guess is added after the account goes: deleting an account takes its own guesses with it.
        await addGuess(3);
        const before = await everything();

        await expectConflict(
          unenrolParticipant(ana.id, { deleteTea: false }, beforeTheEdition),
          holdsDayWithGuesses("Esa persona", 3),
        );
        expect(await everything()).toEqual(before);
      });

      it("says that the day has guesses before saying that the tea is uploaded", async () => {
        const manager = await participationOn(1);
        await addGuess(1);
        const before = await everything();

        await expectConflict(
          unenrolParticipant(manager.id, { deleteTea: false }, beforeTheEdition),
          holdsDayWithGuesses("Deinos", 1),
        );
        expect(await everything()).toEqual(before);
      });

      it.each([
        { dayNumber: 1, name: "Deinos", who: "an account" },
        { dayNumber: 2, name: "Anónimo", who: "a guest" },
      ])(
        "refuses $who with a tea when it is not told to delete the tea, and names them",
        async ({ dayNumber, name }) => {
          const holder = await participationOn(dayNumber);
          const before = await everything();

          await expectConflict(
            unenrolParticipant(holder.id, { deleteTea: false }, beforeTheEdition),
            teaAlreadyUploaded(name),
          );
          expect(await everything()).toEqual(before);
          expect(await prisma.tea.count({ where: { participationId: holder.id } })).toBe(1);
        },
      );

      it.each([EditionStatus.PREPARING, EditionStatus.ACTIVE])(
        "refuses someone with a tea and no day the same way, in an edition that is %s",
        async (status) => {
          await setEditionStatus(status);
          const guest = await enrolGuest(2025, "Prima Lejana");
          await addTea(teaData, [], guest.id);
          const before = await everything();

          await expectConflict(
            unenrolParticipant(guest.id, { deleteTea: false }, duringTheEdition),
            teaAlreadyUploaded("Prima Lejana"),
          );
          expect(await everything()).toEqual(before);
        },
      );

      it("calls the owner of the tea 'Esa persona' when their account was deleted", async () => {
        const manager = await participationOn(1);
        await prisma.user.delete({ where: { id: manager.userId! } });
        const before = await everything();

        await expectConflict(
          unenrolParticipant(manager.id, { deleteTea: false }, beforeTheEdition),
          teaAlreadyUploaded("Esa persona"),
        );
        expect(await everything()).toEqual(before);
      });
    });

    describe("removal", () => {
      it.each([EditionStatus.PREPARING, EditionStatus.ACTIVE])(
        "removes a guest with no day and no tea from an edition that is %s, whatever the date",
        async (status) => {
          await setEditionStatus(status);
          const guest = await enrolGuest(2025, "Prima Lejana");
          const before = await everything();

          const result = await unenrolParticipant(guest.id, { deleteTea: false }, duringTheEdition);

          expect(result.participation).toMatchObject({
            day: null,
            dayId: null,
            guestName: "Prima Lejana",
            id: guest.id,
            tea: null,
            user: null,
            userId: null,
            year: 2025,
          });
          expect(result.storyImagePublicIds).toEqual([]);
          expect(await prisma.participation.findUnique({ where: { id: guest.id } })).toBeNull();
          expect(await everything()).toEqual(without(before, guest.id));
        },
      );

      it("removes an account with no day and no tea: the account itself stays", async () => {
        const user = await userWithoutDay();
        const enrolled = await enrolUser(2025, user.id);
        const before = await everything();

        const result = await unenrolParticipant(enrolled.id, { deleteTea: false }, duringTheEdition);

        expect(result.participation).toMatchObject({
          day: null,
          guestName: null,
          id: enrolled.id,
          tea: null,
          userId: user.id,
          year: 2025,
        });
        expect(result.participation.user).toMatchObject({ id: user.id, username: user.username });
        expect(result.storyImagePublicIds).toEqual([]);
        expect(await prisma.participation.findUnique({ where: { id: enrolled.id } })).toBeNull();
        expect(await prisma.user.findUnique({ where: { id: user.id } })).toEqual(user);
        expect(await everything()).toEqual(without(before, enrolled.id));
      });

      it("removes someone who holds a day that has not opened: the day row stays, held by nobody", async () => {
        const ana = await participationOn(3);
        const three = await day(3);
        const before = await everything();

        const result = await unenrolParticipant(ana.id, { deleteTea: false }, beforeTheEdition);

        expect(result.participation).toMatchObject({ dayId: three.id, id: ana.id, tea: null, userId: ana.userId });
        expect(result.participation.day).toMatchObject({ dayNumber: 3, id: three.id, year: 2025 });
        expect(result.participation.user).toMatchObject({ id: ana.userId, username: "Ñita" });
        expect(result.storyImagePublicIds).toEqual([]);
        expect(await prisma.participation.findUnique({ where: { id: ana.id } })).toBeNull();
        expect(await prisma.day.findUnique({ where: { id: three.id } })).toMatchObject({ dayNumber: 3, year: 2025 });
        expect(await prisma.participation.findUnique({ where: { dayId: three.id } })).toBeNull();
        expect(await prisma.user.findUnique({ where: { id: ana.userId! } })).not.toBeNull();
        // The other four keep their days and their teas, and no row of any other table is touched.
        expect(await everything()).toEqual(without(before, ana.id));
        expect(await prisma.participation.count({ where: { year: 2025 } })).toBe(4);
        expect(await prisma.day.count({ where: { year: 2025 } })).toBe(5);
        expect(await prisma.tea.count()).toBe(2);
      });

      it("removes a guest who holds a day in an edition in preparation, whatever the date", async () => {
        await setEditionStatus(EditionStatus.PREPARING);
        const [guest] = await enrolGuests(1);
        const { dayId: six } = await putOnDay(guest.id, 6);
        const before = await everything();

        const result = await unenrolParticipant(guest.id, { deleteTea: false }, duringTheEdition);

        expect(result.participation).toMatchObject({ dayId: six, guestName: "Invitada 1", id: guest.id, user: null });
        expect(result.participation.day?.dayNumber).toBe(6);
        expect(await prisma.participation.findUnique({ where: { dayId: six! } })).toBeNull();
        expect(await everything()).toEqual(without(before, guest.id));
      });

      it("just removes the participation when told to delete a tea that is not there", async () => {
        const ana = await participationOn(3);
        const before = await everything();

        const result = await unenrolParticipant(ana.id, { deleteTea: true }, beforeTheEdition);

        expect(result.participation).toMatchObject({ id: ana.id, tea: null });
        expect(result.storyImagePublicIds).toEqual([]);
        expect(await everything()).toEqual(without(before, ana.id));
        expect(await prisma.tea.count()).toBe(2);
      });

      it("deletes the tea of an account with its story and images, and hands back the images' public ids", async () => {
        const manager = await participationOn(1);
        const tea = await teaWithStoryOf(manager.id);
        const publicIds = tea.story!.images.map((image) => image.publicId).toSorted();
        expect(publicIds).toHaveLength(3);
        const before = await everything();

        const result = await unenrolParticipant(manager.id, { deleteTea: true }, beforeTheEdition);

        expect(result.storyImagePublicIds.toSorted()).toEqual(publicIds);
        expect(result.participation).toMatchObject({
          dayId: manager.dayId,
          guestName: null,
          id: manager.id,
          userId: manager.userId,
          year: 2025,
        });
        expect(result.participation.day).toMatchObject({ dayNumber: 1, id: manager.dayId, year: 2025 });
        expect(result.participation.tea).toMatchObject({ id: tea.id, name: "Ruta del desierto" });
        expect(result.participation.user).toMatchObject({ id: manager.userId, username: "Deinos" });
        expect(await prisma.participation.findUnique({ where: { id: manager.id } })).toBeNull();
        expect(await prisma.tea.findUnique({ where: { id: tea.id } })).toBeNull();
        expect(await prisma.storyTea.findUnique({ where: { id: tea.story!.id } })).toBeNull();
        expect(await prisma.storyImage.count({ where: { storyTeaId: tea.story!.id } })).toBe(0);
        // The other tea keeps its story and its image; day 1 stays, held by nobody; the account stays.
        const after = await everything();
        expect(after).toEqual(without(before, manager.id));
        expect(after.teas.map((item) => item.name)).toEqual(["Pakistaní"]);
        expect(after.stories).toHaveLength(1);
        expect(after.images.map((image) => image.publicId)).toEqual(["samples/breakfast"]);
        expect(await prisma.participation.findUnique({ where: { dayId: manager.dayId! } })).toBeNull();
        expect(await prisma.user.findUnique({ where: { id: manager.userId! } })).not.toBeNull();
      });

      it("deletes the tea of a guest the same way", async () => {
        const guest = await participationOn(2);
        const tea = await teaWithStoryOf(guest.id);
        const before = await everything();

        const result = await unenrolParticipant(guest.id, { deleteTea: true }, beforeTheEdition);

        expect(result.storyImagePublicIds).toEqual(["samples/breakfast"]);
        expect(result.participation).toMatchObject({ guestName: "Anónimo", id: guest.id, user: null, userId: null });
        expect(result.participation.day?.dayNumber).toBe(2);
        expect(result.participation.tea).toMatchObject({ id: tea.id, name: "Pakistaní" });
        const after = await everything();
        expect(after).toEqual(without(before, guest.id));
        expect(after.teas.map((item) => item.name)).toEqual(["Ruta del desierto"]);
        expect(after.images).toHaveLength(3);
      });

      it("deletes the tea of someone without a day too", async () => {
        const guest = await enrolGuest(2025, "Prima Lejana");
        const tea = await addTea(teaData, [], guest.id);
        const before = await everything();

        const result = await unenrolParticipant(guest.id, { deleteTea: true }, duringTheEdition);

        expect(result.participation).toMatchObject({ day: null, id: guest.id });
        expect(result.participation.tea).toMatchObject({ id: tea.id, name: "Té de prueba" });
        expect(result.storyImagePublicIds).toEqual([]);
        expect(await prisma.tea.findUnique({ where: { id: tea.id } })).toBeNull();
        expect(await everything()).toEqual(without(before, guest.id));
      });

      it("hands back no public ids for a tea without a story", async () => {
        const ana = await participationOn(3);
        const tea = await addTea(teaData, [], ana.id);
        expect(await prisma.storyTea.count({ where: { teaId: tea.id } })).toBe(0);
        const before = await everything();

        const result = await unenrolParticipant(ana.id, { deleteTea: true }, beforeTheEdition);

        expect(result.storyImagePublicIds).toEqual([]);
        expect(result.participation.tea).toMatchObject({ id: tea.id });
        expect(await prisma.tea.findUnique({ where: { id: tea.id } })).toBeNull();
        expect(await everything()).toEqual(without(before, ana.id));
      });

      it("hands back no public ids for a story without images, and deletes the story", async () => {
        const ana = await participationOn(3);
        const tea = await addTea(teaData, [], ana.id);
        const story = await prisma.storyTea.create({ data: { storyPart1: "Érase una vez", teaId: tea.id } });
        const before = await everything();

        const result = await unenrolParticipant(ana.id, { deleteTea: true }, beforeTheEdition);

        expect(result.storyImagePublicIds).toEqual([]);
        expect(await prisma.storyTea.findUnique({ where: { id: story.id } })).toBeNull();
        expect(await prisma.tea.findUnique({ where: { id: tea.id } })).toBeNull();
        expect(await everything()).toEqual(without(before, ana.id));
      });

      it("leaves every guess where it was: those of other days and those the person made", async () => {
        const ana = await participationOn(3);
        await prisma.teaGuess.create({ data: { dayId: (await day(4)).id, userId: ana.userId! } });
        await addGuess(1);
        const before = await everything();

        await unenrolParticipant(ana.id, { deleteTea: false }, beforeTheEdition);

        const after = await everything();
        expect(after.guesses).toEqual(before.guesses);
        expect(after.guesses).toHaveLength(2);
      });

      it("leaves the edition with one participant less: its last day drops by one", async () => {
        const ana = await participationOn(3);
        const guest = await enrolGuest(2025, "Prima Lejana");
        expect((await getEditionInfo(2025)).lastDayNumber).toBe(6);

        await unenrolParticipant(guest.id, { deleteTea: false }, beforeTheEdition);
        expect((await getEditionInfo(2025)).lastDayNumber).toBe(5);

        await unenrolParticipant(ana.id, { deleteTea: false }, beforeTheEdition);
        expect((await getEditionInfo(2025)).lastDayNumber).toBe(4);
      });

      it("lets the same account be enrolled again afterwards, as a new participation without a day", async () => {
        const ana = await participationOn(3);
        await unenrolParticipant(ana.id, { deleteTea: false }, beforeTheEdition);

        const again = await enrolUser(2025, ana.userId!);

        expect(again.id).not.toBe(ana.id);
        expect(again).toMatchObject({ dayId: null, userId: ana.userId, year: 2025 });
        expect(await prisma.participation.count({ where: { userId: ana.userId, year: 2025 } })).toBe(1);
        expect((await getEditionInfo(2025)).lastDayNumber).toBe(5);
      });

      it("removes from its own edition only and leaves the others alone", async () => {
        await upsertEdition(2030, EditionStatus.PREPARING);
        const [ghost, other] = await enrolGuests(2, 2030);
        const before = await everything();

        const result = await unenrolParticipant(ghost.id, { deleteTea: false }, beforeTheEdition);

        expect(result.participation).toMatchObject({ id: ghost.id, year: 2030 });
        expect(await everything()).toEqual(without(before, ghost.id));
        expect(await prisma.participation.findMany({ select: { id: true }, where: { year: 2030 } })).toEqual([
          { id: other.id },
        ]);
        expect((await getEditionInfo(2030)).lastDayNumber).toBe(1);
        expect((await getEditionInfo(2025)).lastDayNumber).toBe(5);
      });
    });

    describe("who is left outside the calendar", () => {
      it("leaves nobody outside when the one removed held the last day", async () => {
        const miko = await participationOn(5);

        const result = await unenrolParticipant(miko.id, { deleteTea: false }, beforeTheEdition);

        expect(result.holdersOutsideCalendar).toEqual([]);
        expect(result.lastDayNumber).toBe(4);
      });

      it("leaves nobody outside when the one removed had no day and nobody holds the last one", async () => {
        const guest = await enrolGuest(2025, "Prima Lejana");

        const result = await unenrolParticipant(guest.id, { deleteTea: false }, beforeTheEdition);

        expect(result.holdersOutsideCalendar).toEqual([]);
        expect(result.lastDayNumber).toBe(5);
      });

      it("leaves the holder of the last day outside when someone without a day is removed", async () => {
        const [waiting, last] = await enrolGuests(2);
        await putOnDay(last.id, 7);

        const result = await unenrolParticipant(waiting.id, { deleteTea: false }, beforeTheEdition);

        expect(result.holdersOutsideCalendar).toEqual([{ dayNumber: 7, name: "Invitada 2" }]);
        expect(result.lastDayNumber).toBe(6);
      });

      it("leaves the holder of the last day outside when the holder of a lower day is removed", async () => {
        const ana = await participationOn(3);

        const result = await unenrolParticipant(ana.id, { deleteTea: false }, beforeTheEdition);

        expect(result.holdersOutsideCalendar).toEqual([{ dayNumber: 5, name: "mikoalilla" }]);
        expect(result.lastDayNumber).toBe(4);
      });

      it("lists everyone left outside, lowest day first: accounts, guests and whoever has no name", async () => {
        const [first, second, removed] = await enrolGuests(4);
        const ana = await participationOn(3);
        const sony = await participationOn(4);
        const miko = await participationOn(5);
        await prisma.user.delete({ where: { id: ana.userId! } });
        // The rows are created out of order, so the order of the days is not the order of creation.
        await putOnDay(ana.id, 10);
        await putOnDay(first.id, 12);
        await putOnDay(second.id, 9);
        await putOnDay(miko.id, 11);
        await putOnDay(sony.id, 8);

        const result = await unenrolParticipant(removed.id, { deleteTea: false }, beforeTheEdition);

        // Eight remain. Sony holds exactly the last day and the fourth guest holds none: neither is outside.
        expect(result.lastDayNumber).toBe(8);
        expect(result.lastDayNumber).toBe(await prisma.participation.count({ where: { year: 2025 } }));
        expect(result.holdersOutsideCalendar).toEqual([
          { dayNumber: 9, name: "Invitada 2" },
          { dayNumber: 10, name: null },
          { dayNumber: 11, name: "mikoalilla" },
          { dayNumber: 12, name: "Invitada 1" },
        ]);
      });

      it("does not list the one removed, whatever day they held", async () => {
        const [stray] = await enrolGuests(1);
        await putOnDay(stray.id, 20);

        const result = await unenrolParticipant(stray.id, { deleteTea: false }, beforeTheEdition);

        expect(result.holdersOutsideCalendar).toEqual([]);
        expect(result.lastDayNumber).toBe(5);
      });

      it("gives the number of participants that remain, which is what the edition says afterwards", async () => {
        const ana = await participationOn(3);
        await enrolGuests(3);

        const result = await unenrolParticipant(ana.id, { deleteTea: false }, beforeTheEdition);

        expect(result.lastDayNumber).toBe(7);
        expect(result.lastDayNumber).toBe((await getEditionInfo(2025)).lastDayNumber);
        expect(result.holdersOutsideCalendar).toEqual([]);
      });

      it.each([
        { holdsDay: true, which: "who held day 1" },
        { holdsDay: false, which: "who had no day" },
      ])("gives 0 and nobody outside when the last participant, $which, goes", async ({ holdsDay }) => {
        await upsertEdition(2030, EditionStatus.PREPARING);
        const [ghost] = await enrolGuests(1, 2030);
        if (holdsDay) {
          const row = await prisma.day.create({ data: { dayNumber: 1, year: 2030 } });
          await prisma.participation.update({ data: { dayId: row.id }, where: { id: ghost.id } });
        }

        const result = await unenrolParticipant(ghost.id, { deleteTea: false }, beforeTheEdition);

        expect(result.lastDayNumber).toBe(0);
        expect(result.holdersOutsideCalendar).toEqual([]);
        expect(await prisma.participation.count({ where: { year: 2030 } })).toBe(0);
      });

      it("keeps each edition to itself: the holders of higher days of another edition are not listed", async () => {
        await upsertEdition(2030, EditionStatus.PREPARING);
        const [low, high, waiting] = await enrolGuests(3, 2030);
        for (const [guest, dayNumber] of [
          [low, 1],
          [high, 9],
        ] as const) {
          const row = await prisma.day.create({ data: { dayNumber, year: 2030 } });
          await prisma.participation.update({ data: { dayId: row.id }, where: { id: guest.id } });
        }
        const ana = await participationOn(3);

        const from2025 = await unenrolParticipant(ana.id, { deleteTea: false }, beforeTheEdition);
        const from2030 = await unenrolParticipant(waiting.id, { deleteTea: false }, beforeTheEdition);

        // Day 9 of 2030 is above the four days 2025 is left with, and days 4 and 5 of 2025 above the two of 2030.
        expect(from2025.lastDayNumber).toBe(4);
        expect(from2025.holdersOutsideCalendar).toEqual([{ dayNumber: 5, name: "mikoalilla" }]);
        expect(from2030.lastDayNumber).toBe(2);
        expect(from2030.holdersOutsideCalendar).toEqual([{ dayNumber: 9, name: "Invitada 2" }]);
      });
    });

    describe("database clashes and races", () => {
      it("deletes nothing when the participation cannot be deleted once its tea was: the tea comes back", async () => {
        const manager = await participationOn(1);
        const tea = await teaWithStoryOf(manager.id);
        expect(tea.story!.images).toHaveLength(3);
        const before = await everything();
        const foreignKeyViolation = new Prisma.PrismaClientKnownRequestError("simulated foreign key violation", {
          clientVersion: "test",
          code: "P2003",
        });
        const teaWasGoneByThen: boolean[] = [];
        type Work = (client: Prisma.TransactionClient) => Promise<unknown>;
        const runTransaction = prisma.$transaction.bind(prisma) as unknown as (
          work: Work,
          ...rest: unknown[]
        ) => Promise<unknown>;
        // The real transaction, on a client whose participation delete fails the way the database does when
        // a tea still points at the row. Everything before it, the tea delete included, has run for real.
        vi.spyOn(prisma, "$transaction").mockImplementation(((work: unknown, ...rest: unknown[]) => {
          if (typeof work !== "function") {
            throw new Error("unenrolParticipant was expected to open an interactive transaction");
          }
          return runTransaction(
            (client) => {
              const participation = new Proxy(client.participation, {
                get(delegate, method) {
                  if (method !== "delete") {
                    return Reflect.get(delegate, method);
                  }
                  return async () => {
                    teaWasGoneByThen.push((await client.tea.findUnique({ where: { id: tea.id } })) === null);
                    throw foreignKeyViolation;
                  };
                },
              });
              const failing = new Proxy(client, {
                get(target, property) {
                  return property === "participation" ? participation : Reflect.get(target, property);
                },
              });
              return (work as Work)(failing);
            },
            ...rest,
          );
        }) as never);

        await expectConflict(
          unenrolParticipant(manager.id, { deleteTea: true }, beforeTheEdition),
          ENROLMENT_JUST_CHANGED,
        );

        // Without this the tea delete would not have run before the failure, and nothing would be proved.
        expect(teaWasGoneByThen).toEqual([true]);
        vi.restoreAllMocks();
        expect(await everything()).toEqual(before);
        expect(await prisma.tea.findUnique({ where: { id: tea.id } })).not.toBeNull();
        expect(await prisma.storyTea.findUnique({ where: { id: tea.story!.id } })).not.toBeNull();
        expect(await prisma.storyImage.count({ where: { storyTeaId: tea.story!.id } })).toBe(3);
        expect(await prisma.participation.findUnique({ where: { id: manager.id } })).not.toBeNull();
      });

      it.each([
        { code: "P2025", message: NO_LONGER_ENROLLED, what: "is gone when the row disappears before the write" },
        { code: "P2003", message: ENROLMENT_JUST_CHANGED, what: "has just changed when the delete hits a foreign key" },
      ])("reports that the participation $what ($code)", async ({ code, message }) => {
        const manager = await participationOn(1);
        const before = await everything();
        const transaction = failNextTransaction(code);

        await expectConflict(unenrolParticipant(manager.id, { deleteTea: true }, beforeTheEdition), message);
        // Without this the call could have answered before ever writing, and the clash would not be exercised.
        expect(transaction).toHaveBeenCalled();
        expect(await everything()).toEqual(before);
      });

      it("lets only one of two unenrolments of the same participation through", async () => {
        for (let round = 0; round < ROUNDS; round++) {
          const racer = await enrolGuest(2025, `Carrera ${round}`);
          const before = await everything();

          const results = await Promise.allSettled([
            unenrolParticipant(racer.id, { deleteTea: false }, beforeTheEdition),
            unenrolParticipant(racer.id, { deleteTea: false }, beforeTheEdition),
          ]);

          expect(results.map((result) => result.status).toSorted()).toEqual(["fulfilled", "rejected"]);
          const [done, refused] = results[0].status === "fulfilled" ? results : results.toReversed();
          if (done.status !== "fulfilled" || refused.status !== "rejected") {
            throw new Error("one call was expected to succeed and the other to fail");
          }
          expect(refused.reason).toBeInstanceOf(ConflictError);
          expect((refused.reason as ConflictError).message).toBe(NO_LONGER_ENROLLED);
          expect(done.value.participation.id).toBe(racer.id);
          expect(await everything()).toEqual(without(before, racer.id));
        }
      });

      it("lets only one of two unenrolments through when there is a tea to delete, and deletes it once", async () => {
        const manager = await participationOn(1);
        const tea = await teaWithStoryOf(manager.id);
        const publicIds = tea.story!.images.map((image) => image.publicId).toSorted();
        const before = await everything();

        const results = await Promise.allSettled([
          unenrolParticipant(manager.id, { deleteTea: true }, beforeTheEdition),
          unenrolParticipant(manager.id, { deleteTea: true }, beforeTheEdition),
        ]);

        expect(results.map((result) => result.status).toSorted()).toEqual(["fulfilled", "rejected"]);
        const [done, refused] = results[0].status === "fulfilled" ? results : results.toReversed();
        if (done.status !== "fulfilled" || refused.status !== "rejected") {
          throw new Error("one call was expected to succeed and the other to fail");
        }
        expect(refused.reason).toBeInstanceOf(ConflictError);
        expect((refused.reason as ConflictError).message).toBe(NO_LONGER_ENROLLED);
        expect(done.value.storyImagePublicIds.toSorted()).toEqual(publicIds);
        const after = await everything();
        expect(after).toEqual(without(before, manager.id));
        expect(after.teas.map((item) => item.name)).toEqual(["Pakistaní"]);
      });

      it.each([
        { holdsDay: false, rowExists: true, target: "a free day" },
        { holdsDay: false, rowExists: false, target: "a day whose row does not exist yet" },
        { holdsDay: true, rowExists: true, target: "a free day, from the day they hold" },
      ])(
        "settles an unenrolment that races the placement of the same person on $target",
        async ({ holdsDay, rowExists }) => {
          // Two more people keep day 6 within the calendar whichever of the two calls gets in first.
          await enrolGuests(2);
          if (rowExists) {
            await addFreeDay(6);
          }

          for (let round = 0; round < ROUNDS; round++) {
            const racer = await enrolGuest(2025, `Carrera ${round}`);
            if (holdsDay) {
              await putOnDay(racer.id, 20 + round);
            }
            const before = await everything();

            const [unenrolled, placed] = await Promise.allSettled([
              unenrolParticipant(racer.id, { deleteTea: false }, beforeTheEdition),
              placeParticipant(racer.id, 6, beforeTheEdition),
            ]);

            expectFulfilledOrConflict(unenrolled);
            expectFulfilledOrConflict(placed);
            const after = await everything();
            // Gone whoever got in first, and nobody else moved: no day row is left pointing at the person.
            expect(await prisma.participation.findUnique({ where: { id: racer.id } })).toBeNull();
            expect(after.participations).toEqual(without(before, racer.id).participations);
            // No day row was lost or renumbered, and the only one that may have appeared is the target's.
            const known = new Set(before.days.map((row) => row.id));
            expect(dayRows(after).filter((row) => known.has(row.id))).toEqual(dayRows(before));
            const added = dayRows(after).filter((row) => !known.has(row.id));
            expect(added.length).toBeLessThanOrEqual(1);
            for (const row of added) {
              expect(row).toMatchObject({ dayNumber: 6, year: 2025 });
            }
            const six = await getDayByDayNumber({ dayNumber: 6, year: 2025 });
            if (placed.status === "fulfilled") {
              expect(placed.value.id).toBe(racer.id);
              expect(six).not.toBeNull();
            }
            if (six) {
              expect(await prisma.participation.findUnique({ where: { dayId: six.id } })).toBeNull();
            }
            expect({ ...after, days: [], participations: [] }).toEqual({ ...before, days: [], participations: [] });
          }
        },
      );

      it.each([
        { partner: "someone who holds a day", partnerHoldsDay: true },
        { partner: "someone without a day", partnerHoldsDay: false },
      ])("settles an unenrolment that races a swap of the same person with $partner", async ({ partnerHoldsDay }) => {
        for (let round = 0; round < ROUNDS; round++) {
          const racer = await enrolGuest(2025, `Carrera ${round}`);
          const partner = await enrolGuest(2025, `Pareja ${round}`);
          const { dayId: racerDay } = await putOnDay(racer.id, 20 + 2 * round);
          const partnerDay = partnerHoldsDay ? (await putOnDay(partner.id, 21 + 2 * round)).dayId : null;
          const before = await everything();

          const [unenrolled, swapped] = await Promise.allSettled([
            unenrolParticipant(racer.id, { deleteTea: false }, beforeTheEdition),
            swapParticipants(racer.id, partner.id, beforeTheEdition),
          ]);

          expectFulfilledOrConflict(unenrolled);
          expectFulfilledOrConflict(swapped);
          const after = await everything();
          expect(await prisma.participation.findUnique({ where: { id: racer.id } })).toBeNull();
          // The swap was either done whole before the person left or not done at all: the partner is on
          // one of the two days, the other one is held by nobody and no row points at the person who left.
          const partnerEndsOn = swapped.status === "fulfilled" ? racerDay : partnerDay;
          expect(after.participations.map(({ dayId, id }) => ({ dayId, id }))).toEqual(
            without(before, racer.id).participations.map(({ dayId, id }) => ({
              dayId: id === partner.id ? partnerEndsOn : dayId,
              id,
            })),
          );
          expect(dayRows(after)).toEqual(dayRows(before));
          expect({ ...after, days: [], participations: [] }).toEqual({ ...before, days: [], participations: [] });
        }
      });

      it("never removes someone whose tea arrives during the unenrolment when the tea is to be kept", async () => {
        for (let round = 0; round < ROUNDS; round++) {
          const racer = await enrolGuest(2025, `Carrera ${round}`);
          const before = await everything();

          const [unenrolled, uploaded] = await Promise.allSettled([
            unenrolParticipant(racer.id, { deleteTea: false }, beforeTheEdition),
            addTea(teaData, [], racer.id),
          ]);

          // One of the two gives way: a tea cannot outlive its participation, and nobody asked to delete it.
          expect([unenrolled.status, uploaded.status].toSorted()).toEqual(["fulfilled", "rejected"]);
          const after = await everything();
          if (unenrolled.status === "rejected") {
            expect(unenrolled.reason).toBeInstanceOf(ConflictError);
            expect([teaAlreadyUploaded(`Carrera ${round}`), ENROLMENT_JUST_CHANGED]).toContain(
              (unenrolled.reason as ConflictError).message,
            );
            expect(after.participations).toEqual(before.participations);
            expect(after.teas.filter((tea) => tea.participationId === racer.id)).toHaveLength(1);
          } else {
            expect(after).toEqual(without(before, racer.id));
          }
        }
      });
    });
  });

  describe("guesses lock the day of their own edition only", () => {
    const now = duringTheEdition;
    const DIRECTIONS = [
      { free: 2030, guessed: 2025 },
      { free: 2025, guessed: 2030 },
    ];

    // Two editions in preparation with the same shape: days 1 to 5 held and one more person without a day.
    async function twoEditionsInPreparation() {
      await setEditionStatus(EditionStatus.PREPARING);
      await enrolGuest(2025, "Prima Lejana");
      await upsertEdition(2030, EditionStatus.PREPARING);
      const guests = await enrolGuests(6, 2030);
      for (const [index, guest] of guests.slice(0, 5).entries()) {
        const row = await prisma.day.create({ data: { dayNumber: index + 1, year: 2030 } });
        await prisma.participation.update({ data: { dayId: row.id }, where: { id: guest.id } });
      }
    }

    async function holderOf(dayNumber: number, year: number) {
      return prisma.participation.findFirstOrThrow({ include: { user: true }, where: { day: { dayNumber, year } } });
    }

    async function someoneWithoutDay(year: number) {
      return prisma.participation.findFirstOrThrow({ where: { dayId: null, year } });
    }

    async function dayIdOf(participationId: string) {
      return (await prisma.participation.findUniqueOrThrow({ where: { id: participationId } })).dayId;
    }

    it.each(DIRECTIONS)(
      "placeParticipant moves people off and onto day 3 of $free while the guess is on day 3 of $guessed, which stays locked",
      async ({ free, guessed }) => {
        await twoEditionsInPreparation();
        await addGuess(3, guessed);
        const mover = await holderOf(3, free);
        const waiting = await someoneWithoutDay(free);
        const locked = await holderOf(3, guessed);
        const lockedOut = await someoneWithoutDay(guessed);

        const moved = await placeParticipant(mover.id, 6, now);
        const placed = await placeParticipant(waiting.id, 3, now);

        expect(moved.day).toMatchObject({ dayNumber: 6, year: free });
        expect(placed.day).toMatchObject({ dayNumber: 3, year: free });
        expect(placed.dayId).toBe(mover.dayId);
        expect((await holderOf(3, free)).id).toBe(waiting.id);
        await expectConflict(placeParticipant(locked.id, 6, now), dayHasGuesses(3));
        await expectConflict(placeParticipant(lockedOut.id, 3, now), dayHasGuesses(3));
        expect((await holderOf(3, guessed)).id).toBe(locked.id);
        expect(await dayIdOf(lockedOut.id)).toBeNull();
        expect(await prisma.teaGuess.count()).toBe(1);
      },
    );

    it.each(DIRECTIONS)(
      "unplaceParticipant frees day 3 of $free while the guess is on day 3 of $guessed, which stays locked",
      async ({ free, guessed }) => {
        await twoEditionsInPreparation();
        await addGuess(3, guessed);
        const mover = await holderOf(3, free);
        const locked = await holderOf(3, guessed);

        const result = await unplaceParticipant(mover.id, now);

        expect(result).toMatchObject({ day: null, dayId: null, id: mover.id });
        expect(await dayIdOf(mover.id)).toBeNull();
        await expectConflict(unplaceParticipant(locked.id, now), dayHasGuesses(3));
        expect(await dayIdOf(locked.id)).toBe(locked.dayId);
      },
    );

    it.each(DIRECTIONS)(
      "swapParticipants swaps day 3 of $free while the guess is on day 3 of $guessed, which stays locked",
      async ({ free, guessed }) => {
        await twoEditionsInPreparation();
        await addGuess(3, guessed);
        const mover = await holderOf(3, free);
        const partner = await holderOf(4, free);
        const locked = await holderOf(3, guessed);
        const lockedPartner = await holderOf(4, guessed);

        const result = await swapParticipants(mover.id, partner.id, now);

        expect(result[0].day).toMatchObject({ dayNumber: 4, year: free });
        expect(result[1].day).toMatchObject({ dayNumber: 3, year: free });
        expect(await dayIdOf(mover.id)).toBe(partner.dayId);
        expect(await dayIdOf(partner.id)).toBe(mover.dayId);
        await expectConflict(swapParticipants(locked.id, lockedPartner.id, now), dayHasGuesses(3));
        await expectConflict(swapParticipants(lockedPartner.id, locked.id, now), dayHasGuesses(3));
        expect(await dayIdOf(locked.id)).toBe(locked.dayId);
        expect(await dayIdOf(lockedPartner.id)).toBe(lockedPartner.dayId);
      },
    );

    it.each(DIRECTIONS)(
      "unenrolParticipant removes the holder of day 3 of $free while the guess is on day 3 of $guessed, whose holder stays",
      async ({ free, guessed }) => {
        await twoEditionsInPreparation();
        await addGuess(3, guessed);
        const mover = await holderOf(3, free);
        const locked = await holderOf(3, guessed);
        const lockedName = locked.user?.username ?? locked.guestName;

        const result = await unenrolParticipant(mover.id, { deleteTea: false }, now);

        expect(result.participation.id).toBe(mover.id);
        expect(await prisma.participation.findUnique({ where: { id: mover.id } })).toBeNull();
        await expectConflict(
          unenrolParticipant(locked.id, { deleteTea: false }, now),
          `${lockedName} tiene el día 3, que ya tiene apuestas: su inscripción no se puede quitar.`,
        );
        expect(await dayIdOf(locked.id)).toBe(locked.dayId);
        expect(await prisma.teaGuess.count()).toBe(1);
      },
    );
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

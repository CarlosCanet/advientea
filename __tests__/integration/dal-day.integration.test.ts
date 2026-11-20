import { describe, expect, it } from "vitest";

import { EditionStatus } from "@/generated/prisma/enums";
import {
  deleteDay,
  enrolGuest,
  getDayById,
  getDayForGuessing,
  getDaysForEdition,
  placeParticipant,
  unplaceParticipant,
  upsertEdition,
} from "@/lib/dal";
import { ConflictError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

const beforeTheEdition = new Date("2025-11-15T12:00:00+01:00");
// Far enough ahead that none of its days has opened whenever the suite runs.
const FUTURE_YEAR = new Date().getFullYear() + 10;

// The seed gives day 1 of 2025 to the manager and day 2 to the guest "Anónimo", both with a tea;
// days 3, 4 and 5 go to ana, sony and miko without one, and the rest are free.
async function seededDay(dayNumber: number) {
  return prisma.day.findUniqueOrThrow({
    include: { participation: { include: { tea: true } } },
    where: { dayNumber_year: { dayNumber, year: 2025 } },
  });
}

async function addGuesses(dayId: string, count: number) {
  const user = await prisma.user.findFirstOrThrow();
  for (let index = 0; index < count; index++) {
    await prisma.teaGuess.create({ data: { dayId, userId: user.id } });
  }
}

/** Every row a deletion could reach, whole: what a refusal must leave as it was. */
async function everything() {
  const [days, participations, teas, guesses] = await Promise.all([
    prisma.day.findMany({ orderBy: { id: "asc" } }),
    prisma.participation.findMany({ orderBy: { id: "asc" } }),
    prisma.tea.findMany({ orderBy: { id: "asc" } }),
    prisma.teaGuess.findMany({ orderBy: { id: "asc" } }),
  ]);
  return { days, guesses, participations, teas };
}

async function expectConflict(call: Promise<unknown>, message: string) {
  const error: unknown = await call.catch((reason: unknown) => reason);
  expect(error).toBeInstanceOf(ConflictError);
  expect((error as ConflictError).message).toBe(message);
}

describe("dal Day", () => {
  describe("getDayById", () => {
    it("returns the tea of whoever holds the day, with its story and images in order", async () => {
      const day = await getDayById((await seededDay(1)).id);

      expect(day?.participation?.tea?.name).toBe("Ruta del desierto");
      expect(day?.participation?.tea?.story?.images.map((image) => image.order)).toEqual([0, 1, 2]);
    });

    it("loads nothing about who holds the day", async () => {
      const day = await getDayById((await seededDay(2)).id);

      expect(Object.keys(day!.participation!)).toEqual(["tea"]);
      expect(JSON.stringify(day)).not.toContain("Anónimo");
    });

    it("returns no tea for a day whose holder has not uploaded one, nor for a free day", async () => {
      const held = await getDayById((await seededDay(3)).id);
      const free = await getDayById((await seededDay(6)).id);

      expect(held?.participation).toEqual({ tea: null });
      expect(free?.participation).toBeNull();
    });
  });

  describe("getDayForGuessing", () => {
    it("returns the tea and the holder of the day, by account or by guest name", async () => {
      const one = await getDayForGuessing((await seededDay(1)).id);
      const two = await getDayForGuessing((await seededDay(2)).id);

      expect(one?.participation?.user?.username).toBe("Deinos");
      expect(one?.participation?.tea).toMatchObject({ name: "Ruta del desierto" });
      expect(one?.participation?.tea?.ingredients).toHaveLength(2);
      expect(two?.participation).toMatchObject({ guestName: "Anónimo", tea: { name: "Pakistaní" }, user: null });
    });
  });

  describe("getDaysForEdition", () => {
    it("returns every day row of the edition, held or not, in order", async () => {
      const rows = await prisma.day.findMany({ orderBy: { dayNumber: "asc" }, where: { year: 2025 } });

      const days = await getDaysForEdition(2025);

      expect(days.map((item) => item.dayNumber)).toEqual(Array.from({ length: 25 }, (_, index) => index + 1));
      expect(days.map((item) => item.id)).toEqual(rows.map((row) => row.id));
    });

    it("orders by day number, not by when the rows were created, and skips no gap", async () => {
      await upsertEdition(2030, EditionStatus.PREPARING);
      const created: Record<number, string> = {};
      for (const dayNumber of [7, 1, 3]) {
        created[dayNumber] = (await prisma.day.create({ data: { dayNumber, year: 2030 } })).id;
      }

      const days = await getDaysForEdition(2030);

      expect(days.map((item) => ({ dayNumber: item.dayNumber, id: item.id }))).toEqual([
        { dayNumber: 1, id: created[1] },
        { dayNumber: 3, id: created[3] },
        { dayNumber: 7, id: created[7] },
      ]);
    });

    it("leaves out the rows of the other editions", async () => {
      await upsertEdition(2030, EditionStatus.PREPARING);
      const other = await prisma.day.create({ data: { dayNumber: 1, year: 2030 } });

      const days = await getDaysForEdition(2025);

      expect(days).toHaveLength(25);
      expect(days.map((item) => item.id)).not.toContain(other.id);
    });

    it("counts the guesses of each day, zero when there are none", async () => {
      await addGuesses((await seededDay(1)).id, 2);
      await addGuesses((await seededDay(6)).id, 1);

      const days = await getDaysForEdition(2025);

      const guessesByDay = new Map(days.map((item) => [item.dayNumber, item._count.guesses]));
      expect(guessesByDay.get(1)).toBe(2);
      expect(guessesByDay.get(6)).toBe(1);
      const others = days.filter((item) => item.dayNumber !== 1 && item.dayNumber !== 6);
      expect(others).toHaveLength(23);
      expect(others.map((item) => item._count.guesses)).toEqual(others.map(() => 0));
    });

    it("counts only the guesses of its own day when another edition has the same number", async () => {
      await upsertEdition(2030, EditionStatus.PREPARING);
      const other = await prisma.day.create({ data: { dayNumber: 6, year: 2030 } });
      await addGuesses(other.id, 3);
      await addGuesses((await seededDay(6)).id, 1);

      const days = await getDaysForEdition(2025);
      const otherDays = await getDaysForEdition(2030);

      expect(days.find((item) => item.dayNumber === 6)?._count.guesses).toBe(1);
      expect(otherDays.map((item) => item._count.guesses)).toEqual([3]);
    });

    it("returns nothing for an edition without days", async () => {
      await upsertEdition(2030, EditionStatus.PREPARING);

      expect(await getDaysForEdition(2030)).toEqual([]);
    });
  });

  describe("deleteDay", () => {
    const heldBy = (dayNumber: number, name: string) =>
      `El día ${dayNumber} es de ${name}. Quítale el día antes de borrarlo.`;

    it("refuses an unknown day and deletes nothing", async () => {
      const before = await everything();

      await expectConflict(deleteDay("no-such-day"), "Ese día ya no existe.");

      expect(await everything()).toEqual(before);
    });

    it("refuses a day that has already been deleted", async () => {
      const six = await seededDay(6);
      await deleteDay(six.id);

      await expectConflict(deleteDay(six.id), "Ese día ya no existe.");
    });

    it.each([
      { dayNumber: 1, holder: "an account with a tea", name: "Deinos" },
      { dayNumber: 3, holder: "an account without a tea", name: "Ñita" },
      { dayNumber: 2, holder: "a guest", name: "Anónimo" },
    ])("refuses a day held by $holder and names them: nothing is deleted", async ({ dayNumber, name }) => {
      const day = await seededDay(dayNumber);
      await addGuesses(day.id, 2);
      const before = await everything();

      await expectConflict(deleteDay(day.id), heldBy(dayNumber, name));

      expect(await everything()).toEqual(before);
      expect((await prisma.participation.findUniqueOrThrow({ where: { id: day.participation!.id } })).dayId).toBe(
        day.id,
      );
    });

    it("refuses a day held by someone whose account was deleted, without a name", async () => {
      const three = await seededDay(3);
      await prisma.user.delete({ where: { id: three.participation!.userId! } });
      const before = await everything();

      await expectConflict(deleteDay(three.id), heldBy(3, "otra persona"));

      expect(await everything()).toEqual(before);
      expect(before.participations.find((participation) => participation.id === three.participation!.id)).toMatchObject(
        { dayId: three.id, guestName: null, userId: null },
      );
    });

    it("names the holder by the username when the participation has a guest name too", async () => {
      const three = await seededDay(3);
      await prisma.participation.update({ data: { guestName: "Apodo" }, where: { id: three.participation!.id } });

      await expectConflict(deleteDay(three.id), heldBy(3, "Ñita"));

      expect(await prisma.day.findUnique({ where: { id: three.id } })).not.toBeNull();
    });

    it("deletes a day nobody holds and resolves with the deleted row", async () => {
      const six = await seededDay(6);

      const result = await deleteDay(six.id);

      expect(result).toMatchObject({ dayNumber: 6, id: six.id, year: 2025 });
      expect(await prisma.day.findUnique({ where: { id: six.id } })).toBeNull();
      expect(await prisma.day.count({ where: { year: 2025 } })).toBe(24);
    });

    it("deletes the guesses of the day with it", async () => {
      const six = await seededDay(6);
      await addGuesses(six.id, 3);

      await deleteDay(six.id);

      expect(await prisma.teaGuess.count({ where: { dayId: six.id } })).toBe(0);
      expect(await prisma.teaGuess.count()).toBe(0);
    });

    it("changes nothing else: other days, participations, teas and the guesses of other days", async () => {
      const six = await seededDay(6);
      await addGuesses(six.id, 2);
      await addGuesses((await seededDay(1)).id, 2);
      await addGuesses((await seededDay(7)).id, 1);
      const before = await everything();

      await deleteDay(six.id);

      const after = await everything();
      expect(after.days).toEqual(before.days.filter((day) => day.id !== six.id));
      expect(after.participations).toEqual(before.participations);
      expect(after.teas).toEqual(before.teas);
      expect(after.guesses).toEqual(before.guesses.filter((guess) => guess.dayId !== six.id));
      expect(after.guesses).toHaveLength(3);
    });

    it("leaves the day with the same number of another edition alone", async () => {
      await upsertEdition(2030, EditionStatus.PREPARING);
      const other = await prisma.day.create({ data: { dayNumber: 6, year: 2030 } });
      await addGuesses(other.id, 1);

      await deleteDay((await seededDay(6)).id);

      expect(await prisma.day.findUnique({ where: { id: other.id } })).not.toBeNull();
      expect(await prisma.teaGuess.count({ where: { dayId: other.id } })).toBe(1);
    });

    // deleteDay takes no clock, so the seeded 2025 days are all in the past and those of FUTURE_YEAR all ahead.
    it.each([
      { status: EditionStatus.ARCHIVED, which: "a day of an archived edition", year: 2025 },
      { status: EditionStatus.ACTIVE, which: "a past day of the active edition", year: 2025 },
      { status: EditionStatus.ACTIVE, which: "a day of the active edition that has not opened", year: FUTURE_YEAR },
      { status: EditionStatus.PREPARING, which: "a day of an edition in preparation", year: FUTURE_YEAR },
    ])("deletes $which the same way, guesses included", async ({ status, year }) => {
      if (year !== 2025) {
        await upsertEdition(2025, EditionStatus.ARCHIVED);
      }
      await upsertEdition(year, status);
      const free = year === 2025 ? await seededDay(6) : await prisma.day.create({ data: { dayNumber: 6, year } });
      await addGuesses(free.id, 2);

      const result = await deleteDay(free.id);

      expect(result).toMatchObject({ dayNumber: 6, id: free.id, year });
      expect(await prisma.day.findUnique({ where: { id: free.id } })).toBeNull();
      expect(await prisma.teaGuess.count({ where: { dayId: free.id } })).toBe(0);
    });

    it("deletes a day once its holder was taken off it: they stay enrolled, with their tea", async () => {
      const one = await seededDay(1);
      const participation = one.participation!;
      expect(participation.tea).not.toBeNull();
      await unplaceParticipant(participation.id, beforeTheEdition);

      const result = await deleteDay(one.id);

      expect(result).toMatchObject({ dayNumber: 1, id: one.id, year: 2025 });
      expect(await prisma.day.findUnique({ where: { id: one.id } })).toBeNull();
      const after = await prisma.participation.findUniqueOrThrow({
        include: { tea: true },
        where: { id: participation.id },
      });
      expect(after).toMatchObject({ dayId: null, userId: participation.userId, year: 2025 });
      expect(after.tea).toEqual(participation.tea);
      expect(await prisma.participation.count({ where: { year: 2025 } })).toBe(5);
    });

    it("lets that person be placed on the same number afterwards, on a new row", async () => {
      const one = await seededDay(1);
      const participation = one.participation!;
      await unplaceParticipant(participation.id, beforeTheEdition);
      await deleteDay(one.id);

      const placed = await placeParticipant(participation.id, 1, beforeTheEdition);

      expect(placed.id).toBe(participation.id);
      expect(placed.day).toMatchObject({ dayNumber: 1, year: 2025 });
      expect(placed.dayId).not.toBe(one.id);
      expect((await seededDay(1)).participation?.tea?.id).toBe(participation.tea!.id);
    });

    // Who wins a race is a matter of timing, so it is run several times, each round on a day of its own.
    const ROUNDS = 6;

    it.each([
      { holdsAnotherDay: false, who: "someone without a day" },
      { holdsAnotherDay: true, who: "someone who holds another day" },
    ])(
      "never deletes the day $who is being placed on at that very moment",
      async ({ holdsAnotherDay }) => {
        // With the seed's five that makes 5 + 2 * ROUNDS participants: every round has a free row within
        // the calendar to fight over, and another one for the person to start on.
        const guests: Awaited<ReturnType<typeof enrolGuest>>[] = [];
        for (let index = 1; index <= ROUNDS * 2; index++) {
          guests.push(await enrolGuest(2025, `Invitada ${index}`));
        }

        for (let round = 0; round < ROUNDS; round++) {
          const guest = guests[round];
          const startNumber = 6 + round;
          const targetNumber = 6 + ROUNDS + round;
          if (holdsAnotherDay) {
            await placeParticipant(guest.id, startNumber, beforeTheEdition);
          }
          const target = await seededDay(targetNumber);
          const start = await prisma.participation.findUniqueOrThrow({ where: { id: guest.id } });
          const others = { id: { not: guest.id }, year: 2025 };
          const othersBefore = await prisma.participation.findMany({ orderBy: { id: "asc" }, where: others });

          const placingCall = () => placeParticipant(guest.id, targetNumber, beforeTheEdition);
          const deletingCall = () => deleteDay(target.id);
          let placing: PromiseSettledResult<Awaited<ReturnType<typeof placeParticipant>>>;
          let deleting: PromiseSettledResult<Awaited<ReturnType<typeof deleteDay>>>;
          // Whichever is sent first tends to get in first, so the rounds take turns.
          if (round % 2 === 0) {
            [placing, deleting] = await Promise.allSettled([placingCall(), deletingCall()]);
          } else {
            [deleting, placing] = await Promise.allSettled([deletingCall(), placingCall()]);
          }

          const person = await prisma.participation.findUniqueOrThrow({
            include: { day: true },
            where: { id: guest.id },
          });
          const rowAfter = await prisma.day.findUnique({ where: { id: target.id } });
          const outcome = `round ${round}: placement ${placing.status}, deletion ${deleting.status}`;

          if (deleting.status === "fulfilled") {
            expect(deleting.value, outcome).toMatchObject({ dayNumber: targetNumber, id: target.id, year: 2025 });
            expect(rowAfter, outcome).toBeNull();
          } else {
            expect(deleting.reason, outcome).toBeInstanceOf(ConflictError);
            expect(rowAfter, outcome).not.toBeNull();
          }

          if (placing.status === "fulfilled") {
            // The one thing that must never happen: a placement that resolved and a person without that day.
            expect(person.day, outcome).toMatchObject({ dayNumber: targetNumber, year: 2025 });
            expect(placing.value.id, outcome).toBe(guest.id);
            expect(placing.value.day, outcome).toMatchObject({ dayNumber: targetNumber, year: 2025 });
            expect(placing.value.dayId, outcome).toBe(person.dayId);
          } else {
            expect(placing.reason, outcome).toBeInstanceOf(ConflictError);
            expect(person.dayId, outcome).toBe(start.dayId);
          }

          expect(await prisma.participation.findMany({ orderBy: { id: "asc" }, where: others }), outcome).toEqual(
            othersBefore,
          );
          if (holdsAnotherDay) {
            expect(await prisma.day.findUnique({ where: { id: start.dayId! } }), outcome).not.toBeNull();
          }
        }
      },
      30_000,
    );
  });
});

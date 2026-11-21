import { Day, Prisma } from "@/generated/prisma/client";
import { ConflictError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { toParticipantName } from "@/lib/utils";

import { storyTeaWithImagesInclude } from "./includes";

// Only the tea of whoever holds the day: the page of a day must not load who that is.
const dayWithParticipationTeaStoryImagesInclude = {
  participation: { select: { tea: { include: { story: { include: storyTeaWithImagesInclude } } } } },
} satisfies Prisma.DayInclude;
export type DayWithParticipationTeaStoryImages = Prisma.DayGetPayload<{
  include: typeof dayWithParticipationTeaStoryImagesInclude;
}>;
const dayWithParticipationTeaStoryImagesAndUserInclude = {
  participation: { include: { tea: { include: { story: { include: storyTeaWithImagesInclude } } }, user: true } },
} satisfies Prisma.DayInclude;
export type DayWithParticipationTeaStoryImagesAndUser = Prisma.DayGetPayload<{
  include: typeof dayWithParticipationTeaStoryImagesAndUserInclude;
}>;
export type DayForGuessing = Prisma.DayGetPayload<{
  select: {
    dayNumber: true;
    participation: {
      select: {
        guestName: true;
        tea: { select: { ingredients: true; name: true; teaType: true } };
        user: { select: { id: true; username: true } };
      };
    };
    year: true;
  };
}>;
export type DayForEdition = Prisma.DayGetPayload<{
  select: { _count: { select: { guesses: true } }; dayNumber: true; id: true };
}>;

export type DayYear = {
  dayNumber: number;
  year: number;
};

export async function getDayById(id: string): Promise<DayWithParticipationTeaStoryImages | null> {
  const dayResponse = await prisma.day.findUnique({
    include: dayWithParticipationTeaStoryImagesInclude,
    where: { id },
  });
  if (!dayResponse) return null;
  return dayResponse;
}

export async function getDayByDayNumber(dayYear: DayYear): Promise<DayWithParticipationTeaStoryImages | null> {
  const dayResponse = await prisma.day.findUnique({
    include: dayWithParticipationTeaStoryImagesInclude,
    where: { dayNumber_year: { dayNumber: dayYear.dayNumber, year: dayYear.year } },
  });
  if (!dayResponse) return null;
  return dayResponse;
}

export async function getDayForGuessing(id: string): Promise<DayForGuessing | null> {
  const dayResponse = await prisma.day.findUnique({
    select: {
      dayNumber: true,
      participation: {
        select: {
          guestName: true,
          tea: { select: { ingredients: true, name: true, teaType: true } },
          user: { select: { id: true, username: true } },
        },
      },
      year: true,
    },
    where: { id },
  });
  return dayResponse;
}

export async function getAllDays(year: number): Promise<Array<DayWithParticipationTeaStoryImagesAndUser>> {
  const allDays = await prisma.day.findMany({
    include: dayWithParticipationTeaStoryImagesAndUserInclude,
    orderBy: { dayNumber: "asc" },
    where: { year },
  });
  return allDays;
}

export async function getDaysForEdition(year: number): Promise<Array<DayForEdition>> {
  return prisma.day.findMany({
    orderBy: { dayNumber: "asc" },
    select: { _count: { select: { guesses: true } }, dayNumber: true, id: true },
    where: { year },
  });
}

export async function editDay(data: Prisma.DayUncheckedUpdateInput, id: string): Promise<Day> {
  const dayUpdated = await prisma.day.update({
    data,
    where: { id },
  });
  return dayUpdated;
}

/** Deletes a day that nobody holds, guesses included. A held day is refused: its holder has to be taken off it first. */
export async function deleteDay(id: string): Promise<Day> {
  try {
    return await prisma.$transaction(
      async (tx) => {
        // The row is locked before its holder is read. Giving a participation this day makes the foreign key
        // check take a key-share lock on the row, which FOR UPDATE excludes: a placement under way is waited
        // for and then seen as the holder, and one that comes later waits and finds the row gone. Checking
        // without the lock would let a placement commit in between and ON DELETE SET NULL undo it in silence.
        await tx.$queryRaw`SELECT "id" FROM "Day" WHERE "id" = ${id} FOR UPDATE`;

        const dayRecord = await tx.day.findUnique({
          select: {
            dayNumber: true,
            participation: { select: { guestName: true, user: { select: { username: true } } } },
          },
          where: { id },
        });
        if (!dayRecord) {
          throw new ConflictError("Ese día ya no existe.");
        }
        if (dayRecord.participation) {
          const holder = toParticipantName(dayRecord.participation) ?? "otra persona";
          throw new ConflictError(`El día ${dayRecord.dayNumber} es de ${holder}. Quítale el día antes de borrarlo.`);
        }
        return tx.day.delete({ where: { id } });
      },
      // The holder must be read as it stands once the lock is granted, not from a snapshot taken before the wait.
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new ConflictError("Ese día ya no existe.");
    }
    throw error;
  }
}

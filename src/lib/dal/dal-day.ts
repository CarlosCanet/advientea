import { Day, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

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
export type DayForEdition = Prisma.DayGetPayload<{ select: { dayNumber: true } }>;

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
    select: { dayNumber: true },
    where: { year },
  });
}

export async function addDay(dayYear: DayYear): Promise<Day | null> {
  try {
    const created = await prisma.day.create({ data: { dayNumber: dayYear.dayNumber, year: dayYear.year } });
    return created;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      console.error(`Day ${dayYear.dayNumber}/${dayYear.year} already exists`);
      return null;
    }
    console.error(error);
    throw error;
  }
}

export async function addNextDay(year: number): Promise<Day | null> {
  let nextDayNumber;
  try {
    const days = await prisma.day.aggregate({
      _max: { dayNumber: true },
      where: { year },
    });
    const maxDay = days._max?.dayNumber ?? 0;
    nextDayNumber = maxDay + 1;
    const created = await prisma.day.create({ data: { dayNumber: nextDayNumber, year } });
    return created;
  } catch (error) {
    console.error(error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      console.error(`Day ${nextDayNumber}/${year} already exists`);
      return null;
    }
    throw error;
  }
}

export async function add25Days(year: number): Promise<number> {
  const days = Array.from({ length: 25 }, (_, i) => ({
    dayNumber: i + 1,
    year,
  }));
  const result = await prisma.day.createMany({
    data: days,
    skipDuplicates: true,
  });
  return result.count;
}

export async function editDay(data: Prisma.DayUncheckedUpdateInput, id: string): Promise<Day> {
  const dayUpdated = await prisma.day.update({
    data,
    where: { id },
  });
  return dayUpdated;
}

export async function deleteDay(id: string): Promise<Day> {
  // Whoever held the day stays in the edition without one, tea included: the tea hangs from the participation.
  return prisma.day.delete({ where: { id } });
}

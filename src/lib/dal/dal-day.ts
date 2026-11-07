import { Day, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

import { storyTeaWithImagesInclude } from "./includes";

const dayWithTeaStoryImagesInclude = {
  tea: { include: { story: { include: storyTeaWithImagesInclude } } },
} satisfies Prisma.DayInclude;
export type DayWithTeaStoryImages = Prisma.DayGetPayload<{ include: typeof dayWithTeaStoryImagesInclude }>;
const dayWithAssignmentUserAndTeaStoryImagesInclude = {
  assignment: { include: { user: true } },
  ...dayWithTeaStoryImagesInclude,
} satisfies Prisma.DayInclude;
export type DayWithAssignmentUserAndTeaStoryImages = Prisma.DayGetPayload<{
  include: typeof dayWithAssignmentUserAndTeaStoryImagesInclude;
}>;
export type DayForGuessing = Prisma.DayGetPayload<{
  select: {
    assignment: { select: { guestName: true; user: { select: { id: true; username: true } } } };
    dayNumber: true;
    tea: { select: { ingredients: true; name: true; teaType: true } };
    year: true;
  };
}>;

export type DayYear = {
  dayNumber: number;
  year: number;
};

export async function getDayById(id: string): Promise<DayWithTeaStoryImages | null> {
  const dayResponse = await prisma.day.findUnique({
    include: dayWithTeaStoryImagesInclude,
    where: { id },
  });
  if (!dayResponse) return null;
  return dayResponse;
}

export async function getDayByDayNumber(dayYear: DayYear): Promise<DayWithTeaStoryImages | null> {
  const dayResponse = await prisma.day.findUnique({
    include: dayWithTeaStoryImagesInclude,
    where: { dayNumber_year: { dayNumber: dayYear.dayNumber, year: dayYear.year } },
  });
  if (!dayResponse) return null;
  return dayResponse;
}

export async function getDayForGuessing(id: string): Promise<DayForGuessing | null> {
  const dayResponse = await prisma.day.findUnique({
    select: {
      assignment: {
        select: {
          guestName: true,
          user: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      },
      dayNumber: true,
      tea: {
        select: {
          ingredients: true,
          name: true,
          teaType: true,
        },
      },
      year: true,
    },
    where: { id },
  });
  return dayResponse;
}

export async function getAllDays(year: number): Promise<Array<DayWithAssignmentUserAndTeaStoryImages>> {
  const allDays = await prisma.day.findMany({
    include: dayWithAssignmentUserAndTeaStoryImagesInclude,
    orderBy: { dayNumber: "asc" },
    where: { year },
  });
  return allDays;
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

export async function deleteDay(id: string): Promise<DayWithTeaStoryImages> {
  // The assignment goes with the day on purpose: since the editions migration its day is SetNull, and
  // an orphan row would still hold the (userId, year) unique and block assigning that person again.
  return prisma.$transaction(async (tx) => {
    await tx.dayAssignment.deleteMany({ where: { dayId: id } });
    return tx.day.delete({
      include: dayWithTeaStoryImagesInclude,
      where: { id },
    });
  });
}

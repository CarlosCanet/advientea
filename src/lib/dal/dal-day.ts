import { Day, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export type DayWithTeaComplete = Prisma.DayGetPayload<{ include: { tea: { include: { story: { include: { images: true } } } } } }>;
export type DayWithAssignmentAndTeaComplete = Prisma.DayGetPayload<{ include: { assignment: { include: { user: true } }, tea: { include: { story: { include: { images: true } } } } } }>

export async function getDay(id: string): Promise<DayWithTeaComplete | null>;
export async function getDay(day: number, year: number): Promise<DayWithTeaComplete | null>;
export async function getDay(idOrDay: string | number, year: number = 2025): Promise<DayWithTeaComplete | null> {
  if (typeof idOrDay === "string") {
    const dayResponse = await prisma.day.findUnique({
      where: { id: idOrDay },
      include: { tea: { include: { story: { include: { images: { orderBy: { order: "asc" } } } } } } },
    })
    if (!dayResponse) return null;
    return dayResponse;
  }
  const dayResponse = await prisma.day.findUnique({
    where: { dayNumber_year: { dayNumber: idOrDay, year: year } },
    include: { tea: { include: { story: { include: { images: { orderBy: { order: "asc" } } } } } } },
  });
  if (!dayResponse) return null;
  return dayResponse;
}

export async function getAllDays(year: number): Promise<Array<DayWithAssignmentAndTeaComplete>> {
  const allDays = await prisma.day.findMany({
    where: { year },
    include: { assignment: { include: { user: true } }, tea: { include: { story: { include: { images: true } } } } },
    orderBy: { dayNumber: "asc" }
  });
  return allDays;
}

export async function addDay(day: number, year: number = 2025): Promise<Day | null> {
  try {
    const created = await prisma.day.create({ data: { dayNumber: day, year: year } });
    return created;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      console.error(`Day ${day}/${year} already exists`);
      return null;
    }
    console.error(error);
    throw error;
  }
}

export async function addNextDay(year: number = 2025): Promise<Day | null> {
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

export async function add25Days(year: number = 2025): Promise<number> {
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
    where: { id },
    data
  });
  return dayUpdated;
}

export async function deleteDay(id: string): Promise<DayWithTeaComplete> {
  const dayDeleted = await prisma.day.delete({
    where: { id },
    include: { tea: { include: { story: { include: { images: true } } } } },
  });
  return dayDeleted;
}
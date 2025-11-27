import { Day, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export async function getDay(day: number, year: number = 2025): Promise<Prisma.DayGetPayload<{ include: { tea: { include: { story: { include: { images: true } } } } } }>> {
  try {
    const dayResponse = await prisma.day.findUnique({
      where: { dayNumber_year: { dayNumber: day, year: year } },
      include: { tea: { include: { story: { include: { images: true } } } } },
    });
    if (!dayResponse) {
      throw new Error(`Day ${day} of year ${year} not found.`);
    }
    return dayResponse;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

export async function getAllDays(year: number): Promise<Array<Prisma.DayGetPayload<{ include: { tea: { include: { story: { include: { images: true } } } } } }>>> {
  try {
    const allDays = await prisma.day.findMany({
      where: { year },
      include: { tea: { include: { story: { include: { images: true } } } } },
      orderBy: { dayNumber: "asc" }
    });
    return allDays;
  } catch (error) {
    console.error(error);
    throw error;
  }
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
  try {
    const days = Array.from({ length: 25 }, (_, i) => ({
      dayNumber: i + 1,
      year,
    }));
    const result = await prisma.day.createMany({
      data: days,
      skipDuplicates: true,
    });
    return result.count;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

export async function editDay(data: Prisma.DayUncheckedUpdateInput, id: string): Promise<Day>;
export async function editDay(data: Prisma.DayUncheckedUpdateInput, day: number, year?: number): Promise<Day>;

export async function editDay(data: Prisma.DayUncheckedUpdateInput, dayOrId: number | string, year: number = 2025 ): Promise<Day> {
  try {
    if (typeof dayOrId === "string") {
      const dayUpdated = await prisma.day.update({
        where: { id: dayOrId },
        data
      });
      return dayUpdated;
    }
    const dayNumber = dayOrId;
    const dayUpdated = await prisma.day.update({
      where: { dayNumber_year: { dayNumber, year } },
      data
    });
    return dayUpdated;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

export async function deleteDay(id: string): Promise<Prisma.DayGetPayload<{ include: { tea: { include: { story: { include: { images: true } } } } } }>> ;
export async function deleteDay(day: number, year?: number): Promise<Prisma.DayGetPayload<{ include: { tea: { include: { story: { include: { images: true } } } } } }>> ;

export async function deleteDay (dayOrId: number | string, year: number = 2025): Promise<Prisma.DayGetPayload<{ include: { tea: { include: { story: { include: { images: true } } } } } }>> {
  try {
    if (typeof dayOrId === "string") {
      const dayDeleted = await prisma.day.delete({
        where: { id: dayOrId },
        include: { tea: { include: { story: { include: { images: true } } } } },
      });
      return dayDeleted;
    }
    
    const dayNumber = dayOrId;
    const result = await prisma.day.delete({
      where: { dayNumber_year: { dayNumber, year } },
      include: { tea: { include: { story: { include: { images: true } } } } },
    });
    return result;
  } catch (error) {
    console.error(error);
    throw error;
  }
}
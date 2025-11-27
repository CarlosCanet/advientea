import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export async function getDayAssignment(id: string): Promise<Prisma.DayAssignmentGetPayload<{ include: { day: { include: { tea: true } }; user: true } }> | null>;
export async function getDayAssignment(year: number, email: string): Promise<Prisma.DayAssignmentGetPayload<{ include: { day: { include: { tea: true } }; user: true } }> | null>;

export async function getDayAssignment(yearOrId: number | string, email?: string): Promise<Prisma.DayAssignmentGetPayload<{ include: { day: { include: { tea: true } }; user: true } }> | null> {
  try {
    if (typeof yearOrId === "string") {
      const assignment = await prisma.dayAssignment.findUnique({
        where: { id: yearOrId },
        include: { day: { include: { tea: true } }, user: true },
      });
      return assignment;
    }

    if (!email) {
      throw new Error("Email is mandatory when getting by year");
    }
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new Error(`The user with email ${email} doesn't exist`);
    }
    const year = yearOrId;
    const assignment = await prisma.dayAssignment.findUnique({
      where: { userId_year: { userId: user.id, year } },
      include: { day: { include: { tea: true } }, user: true },
    });
    return assignment;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

export async function getAllDayAssignment(year: number = 2025): Promise<Array<Prisma.DayAssignmentGetPayload<{ include: { day: { include: { tea: true } }; user: true } }>>> {
  try {
    const assignments = await prisma.dayAssignment.findMany({
      where: { year },
      include: { day: { include: { tea: true } }, user: true },
    });
    return assignments;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

export async function addDayAssignment(email: string, day: number, year: number = 2025): Promise<Prisma.DayAssignmentGetPayload<{ include: { user: true, day: true } }>> {
  email = email.trim().toLowerCase();
  try {
    const dayResponse = await prisma.day.findUnique({
      where: { dayNumber_year: { dayNumber: day, year } },
    });
    const userResponse = await prisma.user.findUnique({ where: { email } });
    if (!dayResponse) {
      throw new Error(`The day ${day}/${year} doesn't exist yet.`);
    }
    if (!userResponse) {
      throw new Error(`The user with email ${email} doesn't exist`);
    }
    const dayAssignment = await prisma.dayAssignment.create({
      data: {
        day: { connect: { id: dayResponse.id } },
        user: { connect: { id: userResponse.id } },
        year,
      },
      include: { day: true, user: true },
    });
    return dayAssignment;
  } catch (error) {
    console.error(error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      console.error("Unique constraint violation creating day assignment.");
    }
    throw error;
  }
}

export async function editDayAssignment(data: Prisma.DayAssignmentUncheckedUpdateInput, id: string): Promise<Prisma.DayAssignmentGetPayload<{ include: { user: true, day: true } }>>;
export async function editDayAssignment(data: Prisma.DayAssignmentUncheckedUpdateInput, year: number, email: string): Promise<Prisma.DayAssignmentGetPayload<{ include: { user: true, day: true } }>>;

export async function editDayAssignment(data: Prisma.DayAssignmentUncheckedUpdateInput, yearOrId: number | string, email?: string): Promise<Prisma.DayAssignmentGetPayload<{ include: { user: true, day: true } }>> {
  try {
    if (typeof yearOrId === "string") {
      const dayAssignmentUpdated = await prisma.dayAssignment.update({
        where: { id: yearOrId },
        include: { day: true, user: true },
        data,
      });
      return dayAssignmentUpdated;
    }
    if (!email) {
      throw new Error("Email is mandatory when editing by year.");
    }
    const year = yearOrId;
    const userResponse = await prisma.user.findUnique({ where: { email } });
    if (!userResponse) {
      throw new Error(`The user with email ${email} doesn't exist`);
    }
    const dayAssignmentUpdated = await prisma.dayAssignment.update({
      where: { userId_year: { userId: userResponse.id, year } },
      include: { day: true, user: true },
      data,
    });
    return dayAssignmentUpdated;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

export async function deleteDayAssignment(id: string): Promise<Prisma.DayAssignmentGetPayload<{ include: { user: true, day: true } }>>;
export async function deleteDayAssignment(year: number, email: string): Promise<Prisma.DayAssignmentGetPayload<{ include: { user: true, day: true } }>>;

export async function deleteDayAssignment(yearOrId: number | string, email?: string): Promise<Prisma.DayAssignmentGetPayload<{ include: { user: true, day: true } }>> {
  try {
    if (typeof yearOrId === "string") {
      const dayAssignmentDeleted = await prisma.dayAssignment.delete({
        where: { id: yearOrId },
        include: { day: true, user: true }
      });
      return dayAssignmentDeleted;
    }
    if (!email) {
      throw new Error("Email is mandatory when deleting by year.");
    }
    const year = yearOrId;
    const userResponse = await prisma.user.findUnique({ where: { email } });
    if (!userResponse) {
      throw new Error(`The user with email ${email} doesn't exist`);
    }
    const result = await prisma.dayAssignment.delete({
      where: { userId_year: { userId: userResponse.id, year } },
      include: { day: true, user: true },
    });
    return result;
  } catch (error) {
    console.error(error);
    throw error;
  }
}
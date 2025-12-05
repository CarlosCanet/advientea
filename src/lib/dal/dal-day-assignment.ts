import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export type DayAssignmentWithDayTeaAndUser = Prisma.DayAssignmentGetPayload<{ include: { day: { include: { tea: true } }; user: true } }>;
export type DayAssignmentWithDayAndUser = Prisma.DayAssignmentGetPayload<{ include: { user: true; day: true } }>;

export async function getDayAssignment(id: string): Promise<DayAssignmentWithDayTeaAndUser | null>;
export async function getDayAssignment(year: number, email: string): Promise<DayAssignmentWithDayTeaAndUser | null>;

export async function getDayAssignment(yearOrId: number | string, email?: string): Promise<DayAssignmentWithDayTeaAndUser | null> {
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

export async function getAllDayAssignment(year: number = 2025): Promise<Array<DayAssignmentWithDayTeaAndUser>> {
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

interface AssigneeInput {
  userId?: string;
  guestName?: string;
}

export async function addDayAssignment(assignee: AssigneeInput, day: number, year: number = 2025): Promise<DayAssignmentWithDayAndUser> {
  const dayResponse = await prisma.day.findUnique({
    where: { dayNumber_year: { dayNumber: day, year } },
  });
  if (!dayResponse) throw new Error(`The day ${day}/${year} does not exist yet.`);

  const data: Prisma.DayAssignmentCreateInput = {
    day: { connect: { id: dayResponse.id } },
    year,
    guestName: null,
  };

  if (assignee.userId) {
    data.user = { connect: { id: assignee.userId } };
  } else if (assignee.guestName) {
    data.guestName = assignee.guestName
  } else {
    throw new Error("Must provide either userId or guestName");
  }

  const dayAssignment = await prisma.dayAssignment.create({
    data,
    include: { day: true, user: true },
  });
  return dayAssignment;
}

export async function editDayAssignment(data: Prisma.DayAssignmentUncheckedUpdateInput, id: string): Promise<DayAssignmentWithDayAndUser> {
  const dayAssignmentUpdated = await prisma.dayAssignment.update({
    where: { id: id },
    include: { day: true, user: true },
    data,
  });
  return dayAssignmentUpdated;
}

export async function deleteDayAssignment(id: string): Promise<DayAssignmentWithDayAndUser> {
  const dayAssignmentDeleted = await prisma.dayAssignment.delete({
    where: { id },
    include: { day: true, user: true },
  });
  return dayAssignmentDeleted;
}

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export type DayAssignmentWithDayTeaAndUser = Prisma.DayAssignmentGetPayload<{
  include: { day: { include: { tea: true } }; user: true };
}>;
export type DayAssignmentWithDayAndUser = Prisma.DayAssignmentGetPayload<{ include: { day: true; user: true } }>;
export type Assigners = Prisma.DayAssignmentGetPayload<{
  select: { guestName: true; user: { select: { username: true } }; userId: true };
}>;

export async function getDayAssignment(id: string): Promise<DayAssignmentWithDayTeaAndUser | null>;
export async function getDayAssignment(year: number, email: string): Promise<DayAssignmentWithDayTeaAndUser | null>;

export async function getDayAssignment(
  yearOrId: number | string,
  email?: string,
): Promise<DayAssignmentWithDayTeaAndUser | null> {
  try {
    if (typeof yearOrId === "string") {
      const assignment = await prisma.dayAssignment.findUnique({
        include: { day: { include: { tea: true } }, user: true },
        where: { id: yearOrId },
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
      include: { day: { include: { tea: true } }, user: true },
      where: { userId_year: { userId: user.id, year } },
    });
    return assignment;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

export async function getDayAssignmentByUserId(
  userId: string,
  year: number = 2025,
): Promise<DayAssignmentWithDayTeaAndUser | null> {
  try {
    const assignment = await prisma.dayAssignment.findUnique({
      include: { day: { include: { tea: true } }, user: true },
      where: { userId_year: { userId: userId, year } },
    });
    return assignment;
  } catch (error: unknown) {
    console.error(error);
    throw error;
  }
}

export async function getAllDayAssignment(year: number = 2025): Promise<Array<DayAssignmentWithDayTeaAndUser>> {
  try {
    const assignments = await prisma.dayAssignment.findMany({
      include: { day: { include: { tea: true } }, user: true },
      where: { year },
    });
    return assignments;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

export async function getAllAssigners(): Promise<Array<Assigners> | null> {
  const result = await prisma.dayAssignment.findMany({
    select: { guestName: true, user: { select: { username: true } }, userId: true },
  });
  return result;
}

interface AssigneeInput {
  guestName?: string;
  userId?: string;
}

export async function addDayAssignment(
  assignee: AssigneeInput,
  day: number,
  year: number = 2025,
): Promise<DayAssignmentWithDayAndUser> {
  const dayResponse = await prisma.day.findUnique({
    where: { dayNumber_year: { dayNumber: day, year } },
  });
  if (!dayResponse) throw new Error(`The day ${day}/${year} does not exist yet.`);

  const data: Prisma.DayAssignmentCreateInput = {
    day: { connect: { id: dayResponse.id } },
    guestName: null,
    year,
  };

  if (assignee.userId) {
    data.user = { connect: { id: assignee.userId } };
  } else if (assignee.guestName) {
    data.guestName = assignee.guestName;
  } else {
    throw new Error("Must provide either userId or guestName");
  }

  const dayAssignment = await prisma.dayAssignment.create({
    data,
    include: { day: true, user: true },
  });
  return dayAssignment;
}

export async function editDayAssignment(
  data: Prisma.DayAssignmentUncheckedUpdateInput,
  id: string,
): Promise<DayAssignmentWithDayAndUser> {
  const dayAssignmentUpdated = await prisma.dayAssignment.update({
    data,
    include: { day: true, user: true },
    where: { id: id },
  });
  return dayAssignmentUpdated;
}

export async function upsertDayAssignment(
  dayId: string,
  assignment: Prisma.DayAssignmentUncheckedCreateInput,
): Promise<DayAssignmentWithDayAndUser> {
  const dayAssignment = await prisma.dayAssignment.upsert({
    create: assignment,
    include: { day: true, user: true },
    update: assignment,
    where: { dayId },
  });
  return dayAssignment;
}

export async function deleteDayAssignment(id: string): Promise<DayAssignmentWithDayAndUser> {
  const dayAssignmentDeleted = await prisma.dayAssignment.delete({
    include: { day: true, user: true },
    where: { id },
  });
  return dayAssignmentDeleted;
}

export async function deleteDayAssignmentByDay(dayId: string): Promise<void> {
  await prisma.dayAssignment.deleteMany({
    where: { dayId },
  });
}

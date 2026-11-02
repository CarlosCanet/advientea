import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

import { DayYear } from "./dal-day";

export type DayAssignmentWithDayTeaAndUser = Prisma.DayAssignmentGetPayload<{
  include: { day: { include: { tea: true } }; user: true };
}>;
export type DayAssignmentWithDayAndUser = Prisma.DayAssignmentGetPayload<{ include: { day: true; user: true } }>;
export type Assigners = Prisma.DayAssignmentGetPayload<{
  select: { guestName: true; user: { select: { username: true } }; userId: true };
}>;

export async function getDayAssignmentById(id: string): Promise<DayAssignmentWithDayTeaAndUser | null> {
  const assignment = await prisma.dayAssignment.findUnique({
    include: { day: { include: { tea: true } }, user: true },
    where: { id },
  });
  return assignment;
}

export async function getDayAssignmentByUserId(
  userId: string,
  year: number,
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

export async function getAllDayAssignment(year: number): Promise<Array<DayAssignmentWithDayTeaAndUser>> {
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
  dayYear: DayYear,
): Promise<DayAssignmentWithDayAndUser> {
  const dayResponse = await prisma.day.findUnique({
    where: { dayNumber_year: { dayNumber: dayYear.dayNumber, year: dayYear.year } },
  });
  if (!dayResponse) throw new Error(`The day ${dayYear.dayNumber}/${dayYear.year} does not exist yet.`);

  const data: Prisma.DayAssignmentCreateInput = {
    day: { connect: { id: dayResponse.id } },
    edition: { connect: { year: dayYear.year } },
    guestName: null,
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

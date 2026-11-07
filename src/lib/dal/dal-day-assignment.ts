import { Prisma } from "@/generated/prisma/client";
import { getDaySchedule } from "@/lib/advientea-rules";
import { getNow } from "@/lib/advientea-time";
import { ConflictError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

import { getEditionInfo } from "./dal-edition";

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

export type Assignee = { guestName: string } | { userId: string };

// Only a day that has not opened yet can change hands: no guess can exist on it.
async function assertDayNotReleased(dayNumber: number, year: number, now: Date): Promise<void> {
  const edition = await getEditionInfo(year);
  if (getDaySchedule(dayNumber, edition, now).isReleased) {
    throw new ConflictError("Ese día ya ha pasado o es hoy y no se puede cambiar.");
  }
}

export async function assignDay(
  dayId: string,
  assignee: Assignee,
  now: Date = getNow(),
): Promise<DayAssignmentWithDayAndUser> {
  return prisma.$transaction(async (tx) => {
    const dayRecord = await tx.day.findUnique({
      include: { assignment: { include: { user: true } } },
      where: { id: dayId },
    });
    if (!dayRecord) {
      throw new Error(`The day with id ${dayId} does not exist.`);
    }
    const current = dayRecord.assignment;
    if (current) {
      // Asking for the person already there changes nothing, so it is fine even once the day has opened:
      // a participant uploads their tea after the calendar opens and the add flow reassigns them.
      const samePerson =
        "userId" in assignee ? current.userId === assignee.userId : current.guestName === assignee.guestName;
      if (samePerson) {
        return tx.dayAssignment.findUniqueOrThrow({ include: { day: true, user: true }, where: { id: current.id } });
      }
      await assertDayNotReleased(dayRecord.dayNumber, dayRecord.year, now);
      // Never replace in silence: the manager frees the day first (S3.3 offers swap or unassign).
      const holder = current.user?.username ?? current.guestName ?? "otra persona";
      throw new ConflictError(`Ese día ya tiene asignada a ${holder}. Libéralo antes de asignar a otra persona.`);
    }
    await assertDayNotReleased(dayRecord.dayNumber, dayRecord.year, now);

    if ("guestName" in assignee) {
      return tx.dayAssignment.create({
        data: {
          day: { connect: { id: dayRecord.id } },
          edition: { connect: { year: dayRecord.year } },
          guestName: assignee.guestName,
        },
        include: { day: true, user: true },
      });
    }

    const participation = await tx.dayAssignment.findUnique({
      include: { day: true },
      where: { userId_year: { userId: assignee.userId, year: dayRecord.year } },
    });
    if (participation?.day) {
      throw new ConflictError(`Esa persona ya tiene el día ${participation.day.dayNumber}.`);
    }
    if (participation) {
      return tx.dayAssignment.update({
        data: { day: { connect: { id: dayRecord.id } } },
        include: { day: true, user: true },
        where: { id: participation.id },
      });
    }
    return tx.dayAssignment.create({
      data: {
        day: { connect: { id: dayRecord.id } },
        edition: { connect: { year: dayRecord.year } },
        user: { connect: { id: assignee.userId } },
      },
      include: { day: true, user: true },
    });
  });
}

export async function unassignDay(dayId: string, now: Date = getNow()): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const dayRecord = await tx.day.findUnique({ include: { assignment: true, tea: true }, where: { id: dayId } });
    if (!dayRecord) {
      throw new Error(`The day with id ${dayId} does not exist.`);
    }
    if (!dayRecord.assignment) {
      return;
    }
    await assertDayNotReleased(dayRecord.dayNumber, dayRecord.year, now);
    if (dayRecord.tea) {
      throw new ConflictError("Ese día tiene un té. Muévelo antes de liberar el día.");
    }
    await tx.dayAssignment.update({ data: { day: { disconnect: true } }, where: { id: dayRecord.assignment.id } });
  });
}

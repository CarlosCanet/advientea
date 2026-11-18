import { Prisma } from "@/generated/prisma/client";
import { getDaySchedule } from "@/lib/advientea-rules";
import { getNow } from "@/lib/advientea-time";
import { ConflictError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

import { getEditionInfo } from "./dal-edition";

export type ParticipationWithDayTeaAndUser = Prisma.ParticipationGetPayload<{
  include: { day: { include: { tea: true } }; user: true };
}>;
export type ParticipationWithDayAndUser = Prisma.ParticipationGetPayload<{ include: { day: true; user: true } }>;
export type Assignee = Prisma.ParticipationGetPayload<{
  select: { guestName: true; user: { select: { username: true } }; userId: true };
}>;

export async function getParticipationById(id: string): Promise<null | ParticipationWithDayTeaAndUser> {
  const participation = await prisma.participation.findUnique({
    include: { day: { include: { tea: true } }, user: true },
    where: { id },
  });
  return participation;
}

export async function getParticipationByUserId(
  userId: string,
  year: number,
): Promise<null | ParticipationWithDayTeaAndUser> {
  try {
    const participation = await prisma.participation.findUnique({
      include: { day: { include: { tea: true } }, user: true },
      where: { userId_year: { userId: userId, year } },
    });
    return participation;
  } catch (error: unknown) {
    console.error(error);
    throw error;
  }
}

export async function getAllParticipations(year: number): Promise<Array<ParticipationWithDayTeaAndUser>> {
  try {
    const participations = await prisma.participation.findMany({
      include: { day: { include: { tea: true } }, user: true },
      where: { year },
    });
    return participations;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

export async function getAssignees(year: number): Promise<Array<Assignee>> {
  const result = await prisma.participation.findMany({
    select: { guestName: true, user: { select: { username: true } }, userId: true },
    where: { year },
  });
  return result;
}

// Only a day that has not opened yet can change hands: no guess can exist on it.
async function assertDayNotReleased(dayNumber: number, year: number, now: Date): Promise<void> {
  const edition = await getEditionInfo(year);
  if (getDaySchedule(dayNumber, edition, now).isReleased) {
    throw new ConflictError("Ese día ya ha pasado o es hoy y no se puede cambiar.");
  }
}

export type AssigneeInput = { guestName: string } | { userId: string };

export async function assignDay(
  dayId: string,
  assignee: AssigneeInput,
  now: Date = getNow(),
): Promise<ParticipationWithDayAndUser> {
  return prisma.$transaction(async (tx) => {
    const dayRecord = await tx.day.findUnique({
      include: { participation: { include: { user: true } } },
      where: { id: dayId },
    });
    if (!dayRecord) {
      throw new Error(`The day with id ${dayId} does not exist.`);
    }
    const current = dayRecord.participation;
    if (current) {
      // Asking for the person already there changes nothing, so it is fine even once the day has opened:
      // a participant uploads their tea after the calendar opens and the add flow reassigns them.
      const samePerson =
        "userId" in assignee ? current.userId === assignee.userId : current.guestName === assignee.guestName;
      if (samePerson) {
        return tx.participation.findUniqueOrThrow({ include: { day: true, user: true }, where: { id: current.id } });
      }
      await assertDayNotReleased(dayRecord.dayNumber, dayRecord.year, now);
      // Never replace in silence: the manager frees the day first (S3.3 offers swap or unassign).
      const holder = current.user?.username ?? current.guestName ?? "otra persona";
      throw new ConflictError(`Ese día ya tiene asignada a ${holder}. Libéralo antes de asignar a otra persona.`);
    }
    await assertDayNotReleased(dayRecord.dayNumber, dayRecord.year, now);

    if ("guestName" in assignee) {
      return tx.participation.create({
        data: {
          day: { connect: { id: dayRecord.id } },
          edition: { connect: { year: dayRecord.year } },
          guestName: assignee.guestName,
        },
        include: { day: true, user: true },
      });
    }

    const participation = await tx.participation.findUnique({
      include: { day: true },
      where: { userId_year: { userId: assignee.userId, year: dayRecord.year } },
    });
    if (participation?.day) {
      throw new ConflictError(`Esa persona ya tiene el día ${participation.day.dayNumber}.`);
    }
    if (participation) {
      return tx.participation.update({
        data: { day: { connect: { id: dayRecord.id } } },
        include: { day: true, user: true },
        where: { id: participation.id },
      });
    }
    return tx.participation.create({
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
    const dayRecord = await tx.day.findUnique({ include: { participation: true, tea: true }, where: { id: dayId } });
    if (!dayRecord) {
      throw new Error(`The day with id ${dayId} does not exist.`);
    }
    if (!dayRecord.participation) {
      return;
    }
    await assertDayNotReleased(dayRecord.dayNumber, dayRecord.year, now);
    if (dayRecord.tea) {
      throw new ConflictError("Ese día tiene un té. Muévelo antes de liberar el día.");
    }
    await tx.participation.update({ data: { day: { disconnect: true } }, where: { id: dayRecord.participation.id } });
  });
}

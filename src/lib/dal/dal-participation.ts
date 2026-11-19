import { randomBytes } from "node:crypto";

import { EditionStatus, Participation, Prisma } from "@/generated/prisma/client";
import { getDaySchedule } from "@/lib/advientea-rules";
import { getNow } from "@/lib/advientea-time";
import { ConflictError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { toParticipantName } from "@/lib/utils";

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
      const holder = toParticipantName(current) ?? "otra persona";
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

async function assertEditionAcceptsEnrolments(tx: Prisma.TransactionClient, year: number): Promise<void> {
  const edition = await tx.edition.findUnique({ where: { year } });
  if (!edition) {
    throw new ConflictError(`La edición ${year} no existe.`);
  }
  if (edition.status === EditionStatus.ARCHIVED) {
    throw new ConflictError(`La edición ${year} está archivada.`);
  }
}

export async function enrolUser(year: number, userId: string): Promise<Participation> {
  try {
    return await prisma.$transaction(async (tx) => {
      await assertEditionAcceptsEnrolments(tx, year);
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new ConflictError("El usuario no existe.");
      }

      return tx.participation.upsert({
        create: { edition: { connect: { year } }, user: { connect: { id: user.id } } },
        update: {},
        where: { userId_year: { userId: user.id, year } },
      });
    });
  } catch (error) {
    // The account or the edition can be deleted between the checks and the write.
    if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2003" || error.code === "P2025")) {
      throw new ConflictError(`Esa persona o la edición ${year} ya no existen.`);
    }
    throw error;
  }
}

export async function enrolGuest(year: number, name: string): Promise<Participation> {
  const guestName = name.trim();
  if (guestName.length === 0) {
    throw new Error("The guest name is empty.");
  }
  try {
    return await prisma.$transaction(async (tx) => {
      await assertEditionAcceptsEnrolments(tx, year);
      const existingGuest = await tx.participation.findFirst({
        where: { guestName: { equals: guestName, mode: "insensitive" }, year },
      });
      if (existingGuest) {
        throw new ConflictError(`${existingGuest.guestName} ya está en la edición ${year} como invitado.`);
      }

      return tx.participation.create({ data: { guestName, guestToken: randomBytes(32).toString("base64url"), year } });
    });
  } catch (error) {
    // The edition can be deleted between the check and the write.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      throw new ConflictError(`La edición ${year} ya no existe.`);
    }
    throw error;
  }
}

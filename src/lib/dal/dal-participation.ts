import { randomBytes } from "node:crypto";

import { EditionStatus, Participation, Prisma } from "@/generated/prisma/client";
import { getNow } from "@/lib/advientea-time";
import { ConflictError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { cleanGuessName, toParticipantName } from "@/lib/utils";

import { getEditionInfo } from "./dal-edition";
import { getDayLock } from "./day-lock";

export type ParticipationWithDayAndTeaAndUser = Prisma.ParticipationGetPayload<{
  include: { day: true; tea: true; user: true };
}>;
export type ParticipationWithDayAndUser = Prisma.ParticipationGetPayload<{ include: { day: true; user: true } }>;
export type Assignee = Prisma.ParticipationGetPayload<{
  select: { guestName: true; user: { select: { username: true } }; userId: true };
}>;
export type ParticipationForEdition = Prisma.ParticipationGetPayload<{
  select: {
    day: { select: { dayNumber: true; id: true } };
    guestName: true;
    id: true;
    tea: { select: { id: true; name: true } };
    user: { select: { username: true } };
    userId: true;
  };
}>;

export async function getParticipationById(id: string): Promise<null | ParticipationWithDayAndTeaAndUser> {
  const participation = await prisma.participation.findUnique({
    include: { day: true, tea: true, user: true },
    where: { id },
  });
  return participation;
}

export async function getParticipationByUserId(
  userId: string,
  year: number,
): Promise<null | ParticipationWithDayAndTeaAndUser> {
  try {
    const participation = await prisma.participation.findUnique({
      include: { day: true, tea: true, user: true },
      where: { userId_year: { userId: userId, year } },
    });
    return participation;
  } catch (error: unknown) {
    console.error(error);
    throw error;
  }
}

export async function getAllParticipations(year: number): Promise<Array<ParticipationWithDayAndTeaAndUser>> {
  try {
    const participations = await prisma.participation.findMany({
      include: { day: true, tea: true, user: true },
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

export async function getParticipationsForEdition(year: number): Promise<Array<ParticipationForEdition>> {
  return prisma.participation.findMany({
    select: {
      day: { select: { dayNumber: true, id: true } },
      guestName: true,
      id: true,
      tea: { select: { id: true, name: true } },
      user: { select: { username: true } },
      userId: true,
    },
    where: { year },
  });
}

// Not invalid input: a manager with a stale page asks about someone another manager has just removed.
export const PARTICIPATION_GONE = "Esa inscripción ya no existe.";

// A locked day cannot change hands: it has opened, or it has guesses.
async function assertDayCanChange(
  tx: Prisma.TransactionClient,
  dayNumber: number,
  year: number,
  now: Date,
): Promise<void> {
  const lock = await getDayLock(tx, dayNumber, await getEditionInfo(year), now);
  if (lock === "opened") {
    throw new ConflictError("Ese día ya ha pasado o es hoy y no se puede cambiar.");
  }
  if (lock === "guesses") {
    throw new ConflictError(`El día ${dayNumber} ya tiene apuestas y no se puede cambiar.`);
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
      await assertDayCanChange(tx, dayRecord.dayNumber, dayRecord.year, now);
      // Never replace in silence: the manager frees the day first (S3.3 offers swap or unassign).
      const holder = toParticipantName(current) ?? "otra persona";
      throw new ConflictError(`Ese día ya tiene asignada a ${holder}. Libéralo antes de asignar a otra persona.`);
    }
    await assertDayCanChange(tx, dayRecord.dayNumber, dayRecord.year, now);

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

/**
 * Gives a participation a day of its own edition, by number. An edition has as many days as participants,
 * so the number must be within 1..N, and the Day row is created the first time someone is placed on it.
 * Whoever held another day leaves that row behind, held by nobody. The tea follows its participation.
 */
export async function placeParticipant(
  participationId: string,
  dayNumber: number,
  now: Date = getNow(),
): Promise<ParticipationWithDayAndUser> {
  if (!Number.isInteger(dayNumber) || dayNumber < 1) {
    throw new Error(`The day number ${dayNumber} is not a positive integer.`);
  }
  try {
    return await prisma.$transaction(async (tx) => {
      const participation = await tx.participation.findUnique({
        include: { day: true, user: true },
        where: { id: participationId },
      });
      if (!participation) {
        throw new ConflictError(PARTICIPATION_GONE);
      }
      const { year } = participation;
      // Asking for the day already held changes nothing, so it is fine even when that day is locked.
      if (participation.day?.dayNumber === dayNumber) {
        return participation;
      }
      if (participation.day) {
        await assertDayCanChange(tx, participation.day.dayNumber, year, now);
      }

      const participantCount = await tx.participation.count({ where: { year } });
      if (dayNumber > participantCount) {
        throw new ConflictError(
          `La edición ${year} tiene ${participantCount} participantes: elige un día entre 1 y ${participantCount}.`,
        );
      }
      await assertDayCanChange(tx, dayNumber, year, now);

      const dayRecord = await tx.day.findUnique({
        include: { participation: { include: { user: true } } },
        where: { dayNumber_year: { dayNumber, year } },
      });
      if (dayRecord?.participation) {
        // Never replace in silence: the manager frees the day first.
        const holder = toParticipantName(dayRecord.participation) ?? "otra persona";
        throw new ConflictError(
          `El día ${dayNumber} ya tiene asignada a ${holder}. Libéralo antes de asignar a otra persona.`,
        );
      }
      const targetDay = dayRecord ?? (await tx.day.create({ data: { dayNumber, year } }));
      // dayId is written as a scalar, not through `connect`, so that when two requests race for the day
      // nothing but the unique index on dayId decides who keeps it.
      return tx.participation.update({
        data: { dayId: targetDay.id },
        include: { day: true, user: true },
        where: { id: participation.id },
      });
    });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
      throw error;
    }
    // Two requests placing someone on the same free day at once: both create its row and the day number
    // collides, or both take the existing row and dayId collides. Either way the other one won.
    if (error.code === "P2002") {
      const participation = await prisma.participation.findUnique({
        include: { day: true, user: true },
        where: { id: participationId },
      });
      // The same placement sent twice: the other request did what this one asked for.
      if (participation?.day?.dayNumber === dayNumber) {
        return participation;
      }
      throw new ConflictError(`El día ${dayNumber} acaba de asignarse a otra persona.`);
    }
    // The participation or the day can be deleted between the checks and the write.
    if (error.code === "P2003" || error.code === "P2025") {
      throw new ConflictError("Esa inscripción o ese día ya no existen.");
    }
    throw error;
  }
}

/** Takes a participant off their day. The Day row stays, held by nobody, and the tea stays with its participation. */
export async function unplaceParticipant(
  participationId: string,
  now: Date = getNow(),
): Promise<ParticipationWithDayAndUser> {
  try {
    return await prisma.$transaction(async (tx) => {
      const participation = await tx.participation.findUnique({
        include: { day: true, user: true },
        where: { id: participationId },
      });
      if (!participation) {
        throw new ConflictError(PARTICIPATION_GONE);
      }
      if (!participation.day) {
        return participation;
      }
      await assertDayCanChange(tx, participation.day.dayNumber, participation.year, now);
      return tx.participation.update({
        data: { dayId: null },
        include: { day: true, user: true },
        where: { id: participation.id },
      });
    });
  } catch (error) {
    // The participation can be deleted between the checks and the write.
    if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2003" || error.code === "P2025")) {
      throw new ConflictError("Esa inscripción o ese día ya no existen.");
    }
    throw error;
  }
}

/**
 * Exchanges the days of two participations of one edition. When only one of them holds a day, it passes to
 * the other. No Day row is created or deleted and the 1..N range is not checked, so someone sitting on a
 * leftover day can be swapped out of it. The teas follow their participations.
 */
export async function swapParticipants(
  firstParticipationId: string,
  secondParticipationId: string,
  now: Date = getNow(),
): Promise<[ParticipationWithDayAndUser, ParticipationWithDayAndUser]> {
  if (firstParticipationId === secondParticipationId) {
    throw new Error("A participation cannot be swapped with itself.");
  }
  try {
    return await prisma.$transaction(async (tx) => {
      // Both rows are locked before they are read, always in id order: an overlapping swap (A<->B and B<->C)
      // waits here and then reads the days as the first one left them, instead of writing over them from a
      // stale read. The unique index on dayId would catch two people on one day, but not a day lost that way.
      await tx.$queryRaw`
        SELECT "id" FROM "DayAssignment"
        WHERE "id" IN (${firstParticipationId}, ${secondParticipationId})
        ORDER BY "id"
        FOR UPDATE
      `;

      const participations = await tx.participation.findMany({
        include: { day: true, user: true },
        where: { id: { in: [firstParticipationId, secondParticipationId] } },
      });
      const first = participations.find((participation) => participation.id === firstParticipationId);
      const second = participations.find((participation) => participation.id === secondParticipationId);
      if (!first || !second) {
        throw new ConflictError(PARTICIPATION_GONE);
      }
      if (first.year !== second.year) {
        throw new Error("The participations belong to different editions.");
      }
      if (!first.day && !second.day) {
        return [first, second];
      }
      for (const day of [first.day, second.day]) {
        if (day) {
          await assertDayCanChange(tx, day.dayNumber, first.year, now);
        }
      }

      // dayId is unique, so both leave their day before either takes the other's.
      await tx.participation.updateMany({ data: { dayId: null }, where: { id: { in: [first.id, second.id] } } });
      const swappedFirst = await tx.participation.update({
        data: { dayId: second.dayId },
        include: { day: true, user: true },
        where: { id: first.id },
      });
      const swappedSecond = await tx.participation.update({
        data: { dayId: first.dayId },
        include: { day: true, user: true },
        where: { id: second.id },
      });
      return [swappedFirst, swappedSecond];
    });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
      throw error;
    }
    // The locks should leave no room for this; the unique index on dayId answers for any writer that gets past them.
    if (error.code === "P2002") {
      throw new ConflictError("Los días acaban de cambiar. Recarga la página y vuelve a intentarlo.");
    }
    // A participation or a day can be deleted between the checks and the write.
    if (error.code === "P2003" || error.code === "P2025") {
      throw new ConflictError("Esa inscripción o ese día ya no existen.");
    }
    throw error;
  }
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
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
      throw error;
    }
    // Two requests enrolling the same person at once: the other one won, and that is the enrolment asked for.
    if (error.code === "P2002") {
      return prisma.participation.findUniqueOrThrow({ where: { userId_year: { userId, year } } });
    }
    // The account or the edition can be deleted between the checks and the write.
    if (error.code === "P2003" || error.code === "P2025") {
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
      // The author guess is scored by name, compared with cleanGuessName: two participants whose names
      // are equal that way could not be told apart, whether the other one is a guest or an account.
      const participants = await tx.participation.findMany({
        select: { guestName: true, user: { select: { username: true } } },
        where: { year },
      });
      const cleanName = cleanGuessName(guestName);
      const sameName = participants.find((participant) => {
        const participantName = toParticipantName(participant);
        return participantName !== null && cleanGuessName(participantName) === cleanName;
      });
      if (sameName) {
        throw new ConflictError(
          sameName.user
            ? `Ya hay una cuenta llamada ${sameName.user.username} en la edición ${year}.`
            : `${sameName.guestName} ya está en la edición ${year} como invitado.`,
        );
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

export type Unenrolment = {
  /** Participants of the edition who now hold a day above its last day, lowest day first. */
  holdersOutsideCalendar: Array<{ dayNumber: number; name: null | string }>;
  /** The edition's last day once the participation is gone: its number of participants. */
  lastDayNumber: number;
  participation: ParticipationWithDayAndTeaAndUser;
  /** Cloudinary assets of the deleted tea's story, for the caller to delete once this has committed. */
  storyImagePublicIds: Array<string>;
};

/**
 * Takes a participation out of its edition, with its tea when the caller has confirmed that. The Day row it
 * held stays, held by nobody, and the edition has one day less: whoever holds a day above the new last one
 * stays on it, outside the calendar, and is reported. Returns the participation as it was.
 */
export async function unenrolParticipant(
  participationId: string,
  options: { deleteTea: boolean },
  now: Date = getNow(),
): Promise<Unenrolment> {
  try {
    return await prisma.$transaction(async (tx) => {
      const participation = await tx.participation.findUnique({
        include: { day: true, user: true },
        where: { id: participationId },
      });
      if (!participation) {
        throw new ConflictError(PARTICIPATION_GONE);
      }
      // The tea is read apart: with three relations in one include, Prisma queries them at once on the
      // transaction's single connection, which pg deprecates and will refuse in pg@9.
      const tea = await tx.tea.findUnique({ where: { participationId: participation.id } });
      const { day, year } = participation;
      const edition = await getEditionInfo(year);
      if (edition.status === EditionStatus.ARCHIVED) {
        throw new ConflictError(`La edición ${year} está archivada.`);
      }
      const name = toParticipantName(participation) ?? "Esa persona";
      if (day) {
        const lock = await getDayLock(tx, day.dayNumber, edition, now);
        if (lock === "opened") {
          throw new ConflictError(
            `${name} tiene el día ${day.dayNumber}, que ya ha pasado o es hoy: su inscripción no se puede quitar.`,
          );
        }
        if (lock === "guesses") {
          throw new ConflictError(
            `${name} tiene el día ${day.dayNumber}, que ya tiene apuestas: su inscripción no se puede quitar.`,
          );
        }
      }
      // A tea is only deleted after an explicit confirmation: without it, the manager's page was stale.
      if (tea && !options.deleteTea) {
        throw new ConflictError(`${name} ya ha subido su té. Recarga la página y vuelve a intentarlo.`);
      }

      let storyImagePublicIds: Array<string> = [];
      if (tea) {
        const images = await tx.storyImage.findMany({
          orderBy: { order: "asc" },
          select: { publicId: true },
          where: { story: { teaId: tea.id } },
        });
        storyImagePublicIds = images.map((image) => image.publicId);
        await tx.tea.delete({ where: { id: tea.id } });
      }
      await tx.participation.delete({ where: { id: participation.id } });

      const lastDayNumber = await tx.participation.count({ where: { year } });
      const daysOutsideCalendar = await tx.day.findMany({
        orderBy: { dayNumber: "asc" },
        select: {
          dayNumber: true,
          participation: { select: { guestName: true, user: { select: { username: true } } } },
        },
        where: { dayNumber: { gt: lastDayNumber }, participation: { isNot: null }, year },
      });
      const holdersOutsideCalendar = daysOutsideCalendar.flatMap((dayOutside) =>
        dayOutside.participation
          ? [{ dayNumber: dayOutside.dayNumber, name: toParticipantName(dayOutside.participation) }]
          : [],
      );
      return { holdersOutsideCalendar, lastDayNumber, participation: { ...participation, tea }, storyImagePublicIds };
    });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
      throw error;
    }
    // Someone else deleted it between the checks and the write.
    if (error.code === "P2025") {
      throw new ConflictError(PARTICIPATION_GONE);
    }
    // A tea created for it between the checks and the write: Tea.participationId restricts the deletion.
    if (error.code === "P2003") {
      throw new ConflictError("Esa inscripción acaba de cambiar. Recarga la página y vuelve a intentarlo.");
    }
    throw error;
  }
}

import { cache } from "react";

import { Edition, EditionStatus, Prisma } from "@/generated/prisma/client";
import { EditionInfo } from "@/lib/advientea-rules";
import { ConflictError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

export async function createEdition(name: string, year: number): Promise<Edition> {
  try {
    const data = await prisma.edition.create({ data: { name, status: EditionStatus.PREPARING, year } });
    return data;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ConflictError(`La edición ${year} ya existe.`);
    }
    throw error;
  }
}

export async function activateEdition(year: number): Promise<Edition> {
  return prisma.$transaction(async (tx) => {
    const edition = await tx.edition.findUnique({ where: { year } });
    if (!edition) {
      throw new ConflictError(`La edición ${year} no existe.`);
    }
    if (edition.status !== EditionStatus.PREPARING) {
      throw new ConflictError(`La edición ${year} no está en preparación.`);
    }
    const editionActive = await tx.edition.findFirst({ where: { status: EditionStatus.ACTIVE } });
    if (editionActive) {
      throw new ConflictError(`La edición ${editionActive.year} está activa. Debes archivarla antes de activar otra.`);
    }
    return tx.edition.update({ data: { status: EditionStatus.ACTIVE }, where: { year } });
  });
}

export async function archiveEdition(year: number): Promise<Edition> {
  return prisma.$transaction(async (tx) => {
    const edition = await tx.edition.findUnique({ where: { year } });
    if (!edition) {
      throw new ConflictError(`La edición ${year} no existe.`);
    }
    if (edition.status !== EditionStatus.ACTIVE) {
      throw new ConflictError(`La edición ${year} no está activa y no puede archivarse.`);
    }
    return tx.edition.update({ data: { status: EditionStatus.ARCHIVED }, where: { year } });
  });
}

export async function deleteEdition(year: number): Promise<Edition> {
  try {
    return await prisma.$transaction(async (tx) => {
      const edition = await tx.edition.findUnique({
        include: { _count: { select: { assignments: true, days: true } } },
        where: { year },
      });
      if (!edition) {
        throw new ConflictError(`La edición ${year} no existe.`);
      }
      if (edition.status !== EditionStatus.PREPARING) {
        throw new ConflictError(`La edición ${year} no está en preparación y no puede borrarse.`);
      }
      if (edition._count.days > 0 || edition._count.assignments > 0) {
        throw new ConflictError(`La edición ${year} ya tiene días o inscritos y no puede borrarse.`);
      }
      return tx.edition.delete({ where: { year } });
    });
  } catch (error) {
    // A day or an enrolment created after the count still trips the Restrict foreign keys.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      throw new ConflictError(`La edición ${year} ya tiene días o inscritos y no puede borrarse.`);
    }
    throw error;
  }
}

export async function getEdition(year: number): Promise<Edition | null> {
  return prisma.edition.findUnique({ where: { year } });
}

export async function getAllEditions(): Promise<Array<Edition>> {
  return prisma.edition.findMany({ orderBy: { year: "desc" } });
}

export const getActiveEdition = cache(async function getActiveEdition(): Promise<Edition | null> {
  return prisma.edition.findFirst({
    orderBy: { year: "desc" },
    where: { status: EditionStatus.ACTIVE },
  });
});

export const getEditionInfo = cache(async function getEditionInfo(year: number): Promise<EditionInfo> {
  const edition = await prisma.edition.findUnique({
    where: { year },
  });
  // Every year the rules ask about comes from a Day, and Day.year is a FK: a missing edition is a broken invariant, not a case.
  if (!edition) {
    throw new Error(`The edition ${year} does not exist.`);
  }
  const result = await prisma.day.aggregate({ _max: { dayNumber: true }, where: { year } });
  const lastDayNumber = result._max.dayNumber ?? 0;
  return { lastDayNumber, status: edition.status, year: edition.year };
});

/** The edition being prepared, if any: what the empty state announces while nothing is active. */
export const getUpcomingEdition = cache(async function getUpcomingEdition(): Promise<Edition | null> {
  return prisma.edition.findFirst({ orderBy: { year: "asc" }, where: { status: EditionStatus.PREPARING } });
});

export async function upsertEdition(year: number, status: EditionStatus): Promise<Edition> {
  return prisma.edition.upsert({
    create: { name: `Advienté ${year}`, status, year },
    update: { status },
    where: { year },
  });
}

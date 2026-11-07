import { cache } from "react";

import { Edition, EditionStatus } from "@/generated/prisma/client";
import { EditionInfo } from "@/lib/advientea-rules";
import { prisma } from "@/lib/prisma";

export async function getEdition(year: number): Promise<Edition | null> {
  return prisma.edition.findUnique({ where: { year } });
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

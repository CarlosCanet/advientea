import { Edition, EditionStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export async function upsertEdition(year: number, status: EditionStatus): Promise<Edition> {
  return prisma.edition.upsert({
    create: { name: `Advienté ${year}`, status, year },
    update: { status },
    where: { year },
  });
}

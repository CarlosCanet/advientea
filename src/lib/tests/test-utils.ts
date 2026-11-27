import { prisma } from "@/lib/prisma";

export async function resetDatabase() {
  // The ingredient catalogue comes from the data migration applied by the global setup, so it
  // stays; the seed only looks it up. Teas go before the participations they hang from, and editions after the days and participations that point to them.
  await prisma.$transaction([
    prisma.storyImage.deleteMany(),
    prisma.storyTea.deleteMany(),
    prisma.teaGuess.deleteMany(),
    prisma.tea.deleteMany(),
    prisma.participation.deleteMany(),
    prisma.day.deleteMany(),
    prisma.edition.deleteMany(),
    prisma.user.deleteMany(),
    prisma.rateLimit.deleteMany(),
    prisma.verification.deleteMany(),
  ]);
}

import { prisma } from "@/lib/prisma";

export async function resetDatabase() {
  // The ingredient catalogue comes from the data migration applied by the global setup, so it
  // stays; the seed only looks it up. Editions go after the days and assignments that point to them.
  await prisma.$transaction([
    prisma.storyImage.deleteMany(),
    prisma.storyTea.deleteMany(),
    prisma.teaGuess.deleteMany(),
    prisma.dayAssignment.deleteMany(),
    prisma.tea.deleteMany(),
    prisma.day.deleteMany(),
    prisma.edition.deleteMany(),
    prisma.user.deleteMany(),
  ]);
}

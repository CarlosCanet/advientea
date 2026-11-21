import { Prisma } from "@/generated/prisma/client";
import { EditionInfo, getDaySchedule } from "@/lib/advientea-rules";

// Shared by the DAL modules that need it and left out of the barrel: callers outside the DAL ask through
// functions that read the day themselves, such as isParticipationDayPlayed.

export type DayLock = "guesses" | "opened";

// The guesses of a day were scored against the tea and author it had, so they lock it whatever the edition
// status: an edition moved back to PREPARING counts no day as opened, and its guesses are still there.
export async function getDayLock(
  tx: Prisma.TransactionClient,
  dayNumber: number,
  edition: EditionInfo,
  now: Date,
): Promise<DayLock | null> {
  if (getDaySchedule(dayNumber, edition, now).isReleased) {
    return "opened";
  }
  const guessCount = await tx.teaGuess.count({ where: { day: { dayNumber, year: edition.year } } });
  return guessCount > 0 ? "guesses" : null;
}

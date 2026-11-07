import { Role } from "@/generated/prisma/enums";
import { DEFAULT_IMAGE_PROFILE, RankingEntry } from "@/lib/types";

import { getAdvienteaDayState } from "../advientea-rules";
import { getDayById, getEditionInfo, getGuessesByDayId, getGuessesByYear } from "../dal";

export async function getDailyRanking(dayId: string): Promise<Array<RankingEntry> | null> {
  const day = await getDayById(dayId);
  if (!day) return null;
  const advienteaDayState = getAdvienteaDayState(day.dayNumber, await getEditionInfo(day.year), Role.USER, false);
  const isPersonNameReleased = advienteaDayState.isPersonNameReleased;
  const allGuesses = await getGuessesByDayId(dayId);
  const uniqueGuesses = new Map<string, (typeof allGuesses)[0]>();
  for (const guess of allGuesses) {
    if (!uniqueGuesses.has(guess.userId)) {
      uniqueGuesses.set(guess.userId, guess);
    }
  }
  const rankingList: Array<RankingEntry> = Array.from(uniqueGuesses.values())
    .toSorted((pos1, pos2) => {
      if (pos2.points !== pos1.points) {
        return pos2.points - pos1.points;
      } else {
        return pos1.createdAt.getTime() - pos2.createdAt.getTime();
      }
    })
    .map((guess, index) => {
      if (!isPersonNameReleased && guess.guessedPersonName && !guess.guessedTeaName && !guess.guessedTeaType) {
        return {
          avatar: guess.user.image ?? DEFAULT_IMAGE_PROFILE,
          points: -1,
          rank: index + 1,
          userId: guess.userId,
          username: guess.user.username,
        };
      } else {
        return {
          avatar: guess.user.image ?? DEFAULT_IMAGE_PROFILE,
          points: guess.points,
          rank: index + 1,
          userId: guess.userId,
          username: guess.user.username,
        };
      }
    });
  return rankingList;
}

export async function getOverallRanking(year: number): Promise<Array<RankingEntry>> {
  const allGuesses = await getGuessesByYear(year);
  const uniqueGuesses = new Map<string, (typeof allGuesses)[0]>();
  for (const guess of allGuesses) {
    const compositeKey = `${guess.userId}_${guess.dayId}`;
    if (!uniqueGuesses.has(compositeKey)) {
      uniqueGuesses.set(compositeKey, guess);
    }
  }
  const uniqueUserGuesses = new Map<string, (typeof allGuesses)[0]>();
  uniqueGuesses.forEach((guess) => {
    const currentPoints = uniqueUserGuesses.get(guess.userId)?.points ?? 0;
    uniqueUserGuesses.set(guess.userId, { ...guess, points: currentPoints + guess.points });
  });

  const rankingList: Array<RankingEntry> = Array.from(uniqueUserGuesses.values())
    .toSorted((pos1, pos2) => {
      return pos2.points - pos1.points;
    })
    .map((guess, index) => ({
      avatar: guess.user.image ?? DEFAULT_IMAGE_PROFILE,
      points: guess.points,
      rank: index + 1,
      userId: guess.userId,
      username: guess.user.username,
    }));
  return rankingList;
}

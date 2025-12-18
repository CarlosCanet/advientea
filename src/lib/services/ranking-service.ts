import { prisma } from "@/lib/prisma";
import { DEFAULT_IMAGE_PROFILE, RankingEntry } from "@/lib/types";
import { getAdvienteaDayState } from "../advientea-rules";
import { getDay } from "../dal";
import { Role } from "@/generated/prisma/enums";

export async function getDailyRanking(dayId: string): Promise<Array<RankingEntry> | null> {
  const day = await getDay(dayId);
  if (!day) return null;
  const advienteaDayState = getAdvienteaDayState(day.dayNumber, day.year, Role.USER, false);
  const isPersonNameReleased = advienteaDayState.isPersonNameReleased;
  const allGuesses = await prisma.teaGuess.findMany({
    where: { dayId },
    include: { user: { select: { username: true, image: true } } },
    orderBy: { createdAt: "desc" },
  });
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
        return ({
          userId: guess.userId,
          avatar: guess.user.image ?? DEFAULT_IMAGE_PROFILE,
          username: guess.user.username,
          points: -1,
          rank: index + 1,
        })
      } else {
        return ({
          userId: guess.userId,
          avatar: guess.user.image ?? DEFAULT_IMAGE_PROFILE,
          username: guess.user.username,
          points: guess.points,
          rank: index + 1,
        })
      }
    });
  return rankingList;
}

export async function getOverallRanking(year: number): Promise<Array<RankingEntry>> {
  return [{ userId: "", username: "", avatar: "", points: 0, rank: 1 }];
}

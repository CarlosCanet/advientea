import { prisma } from "@/lib/prisma";
import { DEFAULT_IMAGE_PROFILE, RankingEntry } from "@/lib/types";

export async function getDailyRanking(dayId: string): Promise<Array<RankingEntry>> {
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
    .map((guess, index) => ({
      userId: guess.userId,
      avatar: guess.user.image ?? DEFAULT_IMAGE_PROFILE,
      username: guess.user.username,
      points: guess.points,
      rank: index + 1,
    }));
  return rankingList;
}

export async function getOverallRanking(year: number): Promise<Array<RankingEntry>> {
  return [{ userId: "", username: "", avatar: "", points: 0, rank: 1 }];
}

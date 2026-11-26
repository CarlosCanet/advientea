import type { RankingEntry } from "@/lib/types";

const PODIUM_SIZE = 3;

export interface RankingView {
  currentUser: null | RankingEntry;
  isCurrentUserOnPodium: boolean;
  podium: RankingEntry[];
  rest: RankingEntry[];
}

/** Splits a ranking, already sorted by the ranking service, into podium and rest, and finds the current user. */
export function toRankingView(entries: ReadonlyArray<RankingEntry>, currentUserId: null | string): RankingView {
  const podium = entries.slice(0, PODIUM_SIZE);
  const rest = entries.slice(PODIUM_SIZE);
  const currentUser = currentUserId === null ? null : (entries.find((entry) => entry.userId === currentUserId) ?? null);
  const isCurrentUserOnPodium = currentUser !== null && podium.includes(currentUser);
  return { currentUser, isCurrentUserOnPodium, podium, rest };
}

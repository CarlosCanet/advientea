import { describe, expect, it } from "vitest";

import { type RankingView, toRankingView } from "@/lib/ranking-view";
import { type RankingEntry } from "@/lib/types";

function entry(userId: string, rank: number, points: number): RankingEntry {
  return {
    avatar: `https://example.com/${userId}.png`,
    points,
    rank,
    userId,
    username: `user-${userId}`,
  };
}

function entries(count: number): RankingEntry[] {
  return Array.from({ length: count }, (_, index) => entry(`u${index + 1}`, index + 1, 100 - index * 10));
}

function frozenCopy(list: RankingEntry[]): ReadonlyArray<RankingEntry> {
  return Object.freeze(list.map((item) => Object.freeze({ ...item })));
}

describe("toRankingView", () => {
  describe("list sizes", () => {
    it("returns an empty view for an empty list", () => {
      const view: RankingView = toRankingView([], "u1");

      expect(view).toEqual({ currentUser: null, isCurrentUserOnPodium: false, podium: [], rest: [] });
    });

    it("returns an empty view for an empty list and no current user", () => {
      expect(toRankingView([], null)).toEqual({
        currentUser: null,
        isCurrentUserOnPodium: false,
        podium: [],
        rest: [],
      });
    });

    it("puts a single entry on the podium and leaves the rest empty", () => {
      const list = entries(1);

      const view = toRankingView(list, null);

      expect(view.podium).toEqual(list);
      expect(view.rest).toEqual([]);
    });

    it("puts two entries on the podium and leaves the rest empty", () => {
      const list = entries(2);

      const view = toRankingView(list, null);

      expect(view.podium).toEqual(list);
      expect(view.rest).toEqual([]);
    });

    it("puts exactly three entries on the podium and leaves the rest empty", () => {
      const list = entries(3);

      const view = toRankingView(list, null);

      expect(view.podium).toEqual(list);
      expect(view.rest).toEqual([]);
    });

    it("puts the first three entries on the podium and every other one in the rest", () => {
      const list = entries(8);

      const view = toRankingView(list, null);

      expect(view.podium).toEqual(list.slice(0, 3));
      expect(view.rest).toEqual(list.slice(3));
      expect(view.podium.length + view.rest.length).toBe(8);
    });

    it("puts the fourth entry alone in the rest when there are four entries", () => {
      const list = entries(4);

      const view = toRankingView(list, null);

      expect(view.podium).toEqual(list.slice(0, 3));
      expect(view.rest).toEqual([list[3]]);
    });
  });

  describe("current user", () => {
    it.each([
      ["first", "u1", 0],
      ["second", "u2", 1],
      ["third", "u3", 2],
    ])("finds the current user on the %s podium place", (_, userId, index) => {
      const list = entries(6);

      const view = toRankingView(list, userId);

      expect(view.currentUser).toEqual(list[index]);
      expect(view.isCurrentUserOnPodium).toBe(true);
    });

    it.each([
      ["fourth", "u4", 3],
      ["last", "u6", 5],
    ])("finds the current user in the %s place, off the podium", (_, userId, index) => {
      const list = entries(6);

      const view = toRankingView(list, userId);

      expect(view.currentUser).toEqual(list[index]);
      expect(view.isCurrentUserOnPodium).toBe(false);
    });

    it("finds the current user on the podium of a list shorter than three", () => {
      const list = entries(2);

      const view = toRankingView(list, "u2");

      expect(view.currentUser).toEqual(list[1]);
      expect(view.isCurrentUserOnPodium).toBe(true);
    });

    it("returns no current user when the id is not in the list", () => {
      const list = entries(6);

      const view = toRankingView(list, "someone-else");

      expect(view.currentUser).toBeNull();
      expect(view.isCurrentUserOnPodium).toBe(false);
      expect(view.podium).toEqual(list.slice(0, 3));
      expect(view.rest).toEqual(list.slice(3));
    });

    it("returns no current user when the id is null", () => {
      const list = entries(6);

      const view = toRankingView(list, null);

      expect(view.currentUser).toBeNull();
      expect(view.isCurrentUserOnPodium).toBe(false);
    });

    it("does not match an empty string id against any entry", () => {
      const view = toRankingView(entries(4), "");

      expect(view.currentUser).toBeNull();
      expect(view.isCurrentUserOnPodium).toBe(false);
    });
  });

  describe("negative points", () => {
    it("keeps entries with negative points on the podium like any other entry", () => {
      const list = [entry("a", 1, -1), entry("b", 2, -1), entry("c", 3, -1), entry("d", 4, -1)];

      const view = toRankingView(list, null);

      expect(view.podium).toEqual(list.slice(0, 3));
      expect(view.rest).toEqual([list[3]]);
    });

    it("marks a current user with negative points on the podium", () => {
      const list = [entry("a", 1, 30), entry("b", 2, -1), entry("c", 3, -1), entry("d", 4, -1)];

      const view = toRankingView(list, "b");

      expect(view.currentUser).toEqual(list[1]);
      expect(view.currentUser?.points).toBe(-1);
      expect(view.isCurrentUserOnPodium).toBe(true);
    });

    it("finds a current user with negative points in the rest", () => {
      const list = [entry("a", 1, 30), entry("b", 2, 20), entry("c", 3, 10), entry("d", 4, -5)];

      const view = toRankingView(list, "d");

      expect(view.currentUser).toEqual(list[3]);
      expect(view.isCurrentUserOnPodium).toBe(false);
    });
  });

  describe("order and rank", () => {
    it("keeps the given order and rank values without re-sorting or re-numbering", () => {
      const list = [
        entry("low", 7, 5),
        entry("high", 2, 90),
        entry("none", 1, -1),
        entry("mid", 9, 40),
        entry("top", 3, 100),
        entry("tie", 2, 90),
      ];

      const view = toRankingView(list, "mid");

      expect(view.podium.map((item) => item.userId)).toEqual(["low", "high", "none"]);
      expect(view.rest.map((item) => item.userId)).toEqual(["mid", "top", "tie"]);
      expect(view.podium.map((item) => item.rank)).toEqual([7, 2, 1]);
      expect(view.rest.map((item) => item.rank)).toEqual([9, 3, 2]);
      expect(view.podium.map((item) => item.points)).toEqual([5, 90, -1]);
      expect(view.rest.map((item) => item.points)).toEqual([40, 100, 90]);
      expect(view.currentUser).toEqual(entry("mid", 9, 40));
      expect(view.isCurrentUserOnPodium).toBe(false);
    });

    it("keeps tied ranks as given", () => {
      const list = [entry("a", 1, 50), entry("b", 1, 50), entry("c", 3, 20), entry("d", 3, 20)];

      const view = toRankingView(list, null);

      expect(view.podium.map((item) => item.rank)).toEqual([1, 1, 3]);
      expect(view.rest.map((item) => item.rank)).toEqual([3]);
    });

    it("keeps every field of each entry unchanged", () => {
      const list = entries(5);

      const view = toRankingView(list, "u5");

      expect([...view.podium, ...view.rest]).toEqual(list);
      expect(view.currentUser).toEqual({
        avatar: "https://example.com/u5.png",
        points: 60,
        rank: 5,
        userId: "u5",
        username: "user-u5",
      });
    });
  });

  describe("immutability", () => {
    it("does not mutate a frozen input", () => {
      const original = entries(6);
      const frozen = frozenCopy(original);

      const view = toRankingView(frozen, "u2");

      expect(frozen).toEqual(original);
      expect(view.podium).toEqual(original.slice(0, 3));
      expect(view.rest).toEqual(original.slice(3));
      expect(view.currentUser).toEqual(original[1]);
    });

    it("returns new arrays, not the input", () => {
      const list = entries(6);

      const view = toRankingView(list, null);

      expect(view.podium).not.toBe(list);
      expect(view.rest).not.toBe(list);
      expect(view.podium).not.toBe(view.rest);
    });

    it("returns a new podium array even when the whole list fits on it", () => {
      const list = entries(3);

      const view = toRankingView(list, null);

      expect(view.podium).not.toBe(list);
      expect(view.podium).toEqual(list);
    });

    it("leaves the input intact when the returned arrays are changed", () => {
      const list = entries(5);
      const snapshot = list.map((item) => ({ ...item }));

      const view = toRankingView(list, null);
      view.podium.pop();
      view.rest.push(entry("extra", 99, 0));

      expect(list).toEqual(snapshot);
    });
  });
});

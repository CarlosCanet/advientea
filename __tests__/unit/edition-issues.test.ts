import { describe, expect, it } from "vitest";

import { type EditionDay, type EditionIssue, type EditionParticipation, findEditionIssues } from "@/lib/edition-issues";

function day(dayNumber: number): EditionDay {
  return { dayNumber };
}

/** A participation with an account. */
function participation(username: string, dayNumber: null | number, hasTea = true): EditionParticipation {
  return { dayNumber, guestName: null, hasTea, id: `participation-${username}`, user: { username } };
}

function guest(guestName: string, dayNumber: null | number, hasTea = true): EditionParticipation {
  return { dayNumber, guestName, hasTea, id: `participation-${guestName}`, user: null };
}

function ofKind(issues: EditionIssue[], kind: EditionIssue["kind"]) {
  return issues.filter((issue) => issue.kind === kind);
}

// The calendar of an edition is one day per participant: with N people enrolled, days 1 to N.
describe("findEditionIssues", () => {
  it("finds nothing in an edition with no days and nobody enrolled", () => {
    expect(findEditionIssues([], [])).toEqual([]);
  });

  it("finds nothing when everyone holds a day of the calendar and has a tea", () => {
    const days = [day(1), day(2), day(3)];
    const participations = [participation("Ana", 1), participation("Sony", 2), guest("Prima Lejana", 3)];

    expect(findEditionIssues(days, participations)).toEqual([]);
  });

  describe("enrolledWithoutDay", () => {
    it("reports a participation that has no day yet, next to the day still free for it", () => {
      const issues = findEditionIssues([day(1)], [participation("Ana", 1), participation("Sony", null)]);

      expect(issues).toEqual([
        { kind: "enrolledWithoutDay", name: "Sony", participationId: "participation-Sony" },
        { dayNumber: 2, kind: "freeDay" },
      ]);
    });

    it("names a guest by the guest name", () => {
      const issues = findEditionIssues([], [guest("Prima Lejana", null)]);

      expect(ofKind(issues, "enrolledWithoutDay")).toEqual([
        { kind: "enrolledWithoutDay", name: "Prima Lejana", participationId: "participation-Prima Lejana" },
      ]);
    });

    it("leaves the name empty when the account behind the participation was deleted", () => {
      const orphan: EditionParticipation = {
        dayNumber: null,
        guestName: null,
        hasTea: true,
        id: "participation-orphan",
        user: null,
      };

      expect(ofKind(findEditionIssues([], [orphan]), "enrolledWithoutDay")).toEqual([
        { kind: "enrolledWithoutDay", name: null, participationId: "participation-orphan" },
      ]);
    });

    it("reports everybody without a day, and every day as free, when nobody has been placed", () => {
      const issues = findEditionIssues([], [participation("Sony", null), participation("Ana", null)]);

      expect(issues).toEqual([
        { kind: "enrolledWithoutDay", name: "Sony", participationId: "participation-Sony" },
        { kind: "enrolledWithoutDay", name: "Ana", participationId: "participation-Ana" },
        { dayNumber: 1, kind: "freeDay" },
        { dayNumber: 2, kind: "freeDay" },
      ]);
    });

    it("does not report someone who holds a day, even one outside the calendar", () => {
      const issues = findEditionIssues([day(1), day(5)], [participation("Ana", 1), participation("Sony", 5)]);

      expect(ofKind(issues, "enrolledWithoutDay")).toEqual([]);
    });
  });

  describe("freeDay", () => {
    it("reports every number of the calendar nobody holds: five enrolled and only day 3 held leaves 1, 2, 4 and 5", () => {
      const participations = [
        participation("Ana", 3),
        participation("Sony", null),
        participation("Miko", null),
        guest("Prima Lejana", null),
        guest("Tío Segundo", null),
      ];

      const issues = findEditionIssues([day(3)], participations);

      expect(ofKind(issues, "freeDay")).toEqual([
        { dayNumber: 1, kind: "freeDay" },
        { dayNumber: 2, kind: "freeDay" },
        { dayNumber: 4, kind: "freeDay" },
        { dayNumber: 5, kind: "freeDay" },
      ]);
    });

    it("reports a free day whether or not it has a row", () => {
      const participations = [participation("Ana", 1), participation("Sony", null)];
      const expected = [
        { kind: "enrolledWithoutDay", name: "Sony", participationId: "participation-Sony" },
        { dayNumber: 2, kind: "freeDay" },
      ];

      expect(findEditionIssues([day(1), day(2)], participations)).toEqual(expected);
      expect(findEditionIssues([day(1)], participations)).toEqual(expected);
    });

    it("does not report a held day of the calendar, the last one included", () => {
      const participations = [participation("Ana", 2), participation("Sony", null)];

      expect(ofKind(findEditionIssues([day(2)], participations), "freeDay")).toEqual([
        { dayNumber: 1, kind: "freeDay" },
      ]);
    });

    it("never reports a number above the number of participants as free", () => {
      const days = [day(1), day(2), day(3), day(4)];
      const participations = [participation("Ana", 1), participation("Sony", null)];

      expect(ofKind(findEditionIssues(days, participations), "freeDay")).toEqual([{ dayNumber: 2, kind: "freeDay" }]);
    });

    it("reports as many free days as people without a day when nobody holds a day outside the calendar", () => {
      const days = [day(2), day(5), day(7), day(8)];
      const participations = [
        participation("Ana", 5),
        participation("Sony", null),
        guest("Prima Lejana", 2),
        participation("Miko", null),
        guest("Tío Segundo", null),
        participation("Zoe", null),
      ];

      const issues = findEditionIssues(days, participations);

      const free = ofKind(issues, "freeDay");
      expect(free).toEqual([1, 3, 4, 6].map((dayNumber) => ({ dayNumber, kind: "freeDay" })));
      expect(ofKind(issues, "enrolledWithoutDay")).toHaveLength(free.length);
    });
  });

  describe("dayOutsideCalendar", () => {
    it("reports a row above the number of participants that nobody holds", () => {
      const days = [day(1), day(2), day(3)];
      const participations = [participation("Ana", 1), participation("Sony", 2)];

      expect(findEditionIssues(days, participations)).toEqual([{ dayNumber: 3, kind: "dayOutsideCalendar" }]);
    });

    it("reports a row above the number of participants that somebody holds, once", () => {
      const issues = findEditionIssues([day(1), day(5)], [participation("Ana", 1), participation("Sony", 5)]);

      expect(issues).toEqual([
        { dayNumber: 5, kind: "dayOutsideCalendar" },
        { dayNumber: 2, kind: "freeDay" },
      ]);
    });

    it("reports a day above the number of participants that somebody holds even when its row is not listed", () => {
      const issues = findEditionIssues([day(1)], [participation("Ana", 1), participation("Sony", 5)]);

      expect(issues).toEqual([
        { dayNumber: 5, kind: "dayOutsideCalendar" },
        { dayNumber: 2, kind: "freeDay" },
      ]);
    });

    it("does not report the last day of the calendar", () => {
      const days = [day(1), day(2)];
      const participations = [participation("Ana", 1), participation("Sony", 2)];

      expect(ofKind(findEditionIssues(days, participations), "dayOutsideCalendar")).toEqual([]);
    });

    it("reports every row, by day number, when nobody is enrolled", () => {
      expect(findEditionIssues([day(3), day(1), day(2)], [])).toEqual([
        { dayNumber: 1, kind: "dayOutsideCalendar" },
        { dayNumber: 2, kind: "dayOutsideCalendar" },
        { dayNumber: 3, kind: "dayOutsideCalendar" },
      ]);
    });
  });

  describe("participantWithoutTea", () => {
    it("reports a participant with a day and no tea, with the day", () => {
      const issues = findEditionIssues([day(1), day(2)], [participation("Ana", 1), participation("Sony", 2, false)]);

      expect(issues).toEqual([
        { dayNumber: 2, kind: "participantWithoutTea", name: "Sony", participationId: "participation-Sony" },
      ]);
    });

    it("reports a participant with neither day nor tea under both kinds", () => {
      const issues = findEditionIssues([day(1)], [participation("Ana", 1), guest("Prima Lejana", null, false)]);

      expect(issues).toEqual([
        { kind: "enrolledWithoutDay", name: "Prima Lejana", participationId: "participation-Prima Lejana" },
        { dayNumber: 2, kind: "freeDay" },
        {
          dayNumber: null,
          kind: "participantWithoutTea",
          name: "Prima Lejana",
          participationId: "participation-Prima Lejana",
        },
      ]);
    });

    it("reports a participant without tea on a day outside the calendar, with that day", () => {
      const issues = findEditionIssues([day(1), day(5)], [participation("Ana", 1), participation("Sony", 5, false)]);

      expect(ofKind(issues, "participantWithoutTea")).toEqual([
        { dayNumber: 5, kind: "participantWithoutTea", name: "Sony", participationId: "participation-Sony" },
      ]);
    });

    it("does not report the tea of someone who uploaded it before having a day", () => {
      const issues = findEditionIssues([], [participation("Ana", null, true)]);

      expect(ofKind(issues, "participantWithoutTea")).toEqual([]);
    });
  });

  it("orders the issues by kind and, within a kind, by day number or by input order", () => {
    const days = [day(8), day(6), day(4), day(9), day(2), day(1)];
    const participations = [
      participation("Zoe", null, false),
      participation("Miko", 4, false),
      participation("Ana", null, false),
      participation("Leo", 9, false),
      participation("Sony", 1, false),
      guest("Prima Lejana", 2),
    ];

    expect(findEditionIssues(days, participations)).toEqual([
      { dayNumber: 8, kind: "dayOutsideCalendar" },
      { dayNumber: 9, kind: "dayOutsideCalendar" },
      { kind: "enrolledWithoutDay", name: "Zoe", participationId: "participation-Zoe" },
      { kind: "enrolledWithoutDay", name: "Ana", participationId: "participation-Ana" },
      { dayNumber: 3, kind: "freeDay" },
      { dayNumber: 5, kind: "freeDay" },
      { dayNumber: 6, kind: "freeDay" },
      { dayNumber: 1, kind: "participantWithoutTea", name: "Sony", participationId: "participation-Sony" },
      { dayNumber: 4, kind: "participantWithoutTea", name: "Miko", participationId: "participation-Miko" },
      { dayNumber: 9, kind: "participantWithoutTea", name: "Leo", participationId: "participation-Leo" },
      { dayNumber: null, kind: "participantWithoutTea", name: "Zoe", participationId: "participation-Zoe" },
      { dayNumber: null, kind: "participantWithoutTea", name: "Ana", participationId: "participation-Ana" },
    ]);
  });

  it("does not change the arrays it receives", () => {
    const days = [day(7), day(3), day(1)];
    const participations = [participation("Sony", 3, false), participation("Ana", null), participation("Miko", 1)];
    const daysBefore = structuredClone(days);
    const participationsBefore = structuredClone(participations);

    findEditionIssues(days, participations);

    expect(days).toEqual(daysBefore);
    expect(participations).toEqual(participationsBefore);
  });
});

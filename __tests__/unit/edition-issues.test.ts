import { describe, expect, it } from "vitest";

import { type EditionDay, type EditionParticipation, findEditionIssues } from "@/lib/edition-issues";

function day(dayNumber: number, hasTea = true): EditionDay {
  return { dayNumber, hasTea };
}

/** A participation with an account. */
function participation(username: string, dayNumber: null | number): EditionParticipation {
  return { dayNumber, guestName: null, id: `participation-${username}`, user: { username } };
}

function guest(guestName: string, dayNumber: null | number): EditionParticipation {
  return { dayNumber, guestName, id: `participation-${guestName}`, user: null };
}

describe("findEditionIssues", () => {
  it("finds nothing in an edition with no days and nobody enrolled", () => {
    expect(findEditionIssues([], [])).toEqual([]);
  });

  it("finds nothing when every day has its participant and its tea", () => {
    const days = [day(1), day(2), day(3)];
    const participations = [participation("Ana", 1), participation("Sony", 2), participation("Miko", 3)];

    expect(findEditionIssues(days, participations)).toEqual([]);
  });

  it("reports a participation that has no day yet", () => {
    const issues = findEditionIssues([day(1)], [participation("Ana", 1), participation("Sony", null)]);

    expect(issues).toEqual([{ kind: "enrolledWithoutDay", name: "Sony", participationId: "participation-Sony" }]);
  });

  it("names a guest by the guest name", () => {
    const issues = findEditionIssues([], [guest("Prima Lejana", null)]);

    expect(issues).toEqual([
      { kind: "enrolledWithoutDay", name: "Prima Lejana", participationId: "participation-Prima Lejana" },
    ]);
  });

  it("leaves the name empty when the account behind the participation was deleted", () => {
    const orphan: EditionParticipation = { dayNumber: null, guestName: null, id: "participation-orphan", user: null };

    expect(findEditionIssues([], [orphan])).toEqual([
      { kind: "enrolledWithoutDay", name: null, participationId: "participation-orphan" },
    ]);
  });

  it("reports everybody as without day when the edition has no days", () => {
    const issues = findEditionIssues([], [participation("Ana", null), participation("Sony", null)]);

    expect(issues).toEqual([
      { kind: "enrolledWithoutDay", name: "Ana", participationId: "participation-Ana" },
      { kind: "enrolledWithoutDay", name: "Sony", participationId: "participation-Sony" },
    ]);
  });

  it("reports a day with neither participant nor tea as empty", () => {
    const issues = findEditionIssues([day(1), day(2, false)], [participation("Ana", 1)]);

    expect(issues).toEqual([{ dayNumber: 2, kind: "emptyDay" }]);
  });

  it("reports a day with a tea and no participant as a tea without owner, not as an empty day", () => {
    const issues = findEditionIssues([day(1), day(2)], [participation("Ana", 1)]);

    expect(issues).toEqual([{ dayNumber: 2, kind: "teaWithoutOwner" }]);
  });

  it("reports a participant whose day has no tea", () => {
    const issues = findEditionIssues([day(1), day(2, false)], [participation("Ana", 1), participation("Sony", 2)]);

    expect(issues).toEqual([
      { dayNumber: 2, kind: "participantWithoutTea", name: "Sony", participationId: "participation-Sony" },
    ]);
  });

  it("reports every missing number between 1 and the last day as a gap", () => {
    const days = [day(2), day(5)];
    const participations = [participation("Ana", 2), participation("Sony", 5)];

    expect(findEditionIssues(days, participations)).toEqual([
      { dayNumber: 1, kind: "gap" },
      { dayNumber: 3, kind: "gap" },
      { dayNumber: 4, kind: "gap" },
    ]);
  });

  it("does not report days after the last one as gaps", () => {
    const issues = findEditionIssues([day(1), day(2)], [participation("Ana", 1), participation("Sony", 2)]);

    expect(issues.filter((issue) => issue.kind === "gap")).toEqual([]);
  });

  it("orders the issues by kind and, within a kind, by day number whatever the input order", () => {
    const days = [day(7, false), day(6), day(4, false), day(3, false), day(1)];
    const participations = [
      participation("Zoe", null),
      participation("Miko", 4),
      participation("Ana", null),
      participation("Sony", 1),
    ];

    expect(findEditionIssues(days, participations)).toEqual([
      { dayNumber: 6, kind: "teaWithoutOwner" },
      { kind: "enrolledWithoutDay", name: "Zoe", participationId: "participation-Zoe" },
      { kind: "enrolledWithoutDay", name: "Ana", participationId: "participation-Ana" },
      { dayNumber: 2, kind: "gap" },
      { dayNumber: 5, kind: "gap" },
      { dayNumber: 3, kind: "emptyDay" },
      { dayNumber: 7, kind: "emptyDay" },
      { dayNumber: 4, kind: "participantWithoutTea", name: "Miko", participationId: "participation-Miko" },
    ]);
  });

  it("does not change the arrays it receives", () => {
    const days = [day(3), day(1)];
    const participations = [participation("Ana", 3), participation("Sony", 1)];

    findEditionIssues(days, participations);

    expect(days.map((item) => item.dayNumber)).toEqual([3, 1]);
    expect(participations.map((item) => item.user?.username)).toEqual(["Ana", "Sony"]);
  });
});

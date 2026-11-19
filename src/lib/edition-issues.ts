import { type ParticipantNameSource, toParticipantName } from "./utils";

export type EditionDay = { dayNumber: number };
export type EditionParticipation = ParticipantNameSource & { dayNumber: null | number; hasTea: boolean; id: string };

export type EditionIssue =
  | { dayNumber: null | number; kind: "participantWithoutTea"; name: null | string; participationId: string }
  | { dayNumber: number; kind: "emptyDay" }
  | { dayNumber: number; kind: "gap" }
  | { kind: "enrolledWithoutDay"; name: null | string; participationId: string };

/**
 * What an edition still lacks before it can open. Nothing here blocks: the manager decides.
 * The result is ordered by kind, most serious first, and by day number within a kind.
 */
export function findEditionIssues(
  days: ReadonlyArray<EditionDay>,
  participations: ReadonlyArray<EditionParticipation>,
): Array<EditionIssue> {
  const heldDayNumbers = new Set<number>();
  const enrolledWithoutDay: Array<EditionIssue> = [];
  for (const participation of participations) {
    if (participation.dayNumber === null) {
      enrolledWithoutDay.push({
        kind: "enrolledWithoutDay",
        name: toParticipantName(participation),
        participationId: participation.id,
      });
    } else {
      heldDayNumbers.add(participation.dayNumber);
    }
  }

  const sortedDayNumbers = days.map((day) => day.dayNumber).sort((first, second) => first - second);
  const emptyDays: Array<EditionIssue> = sortedDayNumbers
    .filter((dayNumber) => !heldDayNumbers.has(dayNumber))
    .map((dayNumber) => ({ dayNumber, kind: "emptyDay" }));

  const gaps: Array<EditionIssue> = [];
  const existingDayNumbers = new Set(sortedDayNumbers);
  const lastDayNumber = sortedDayNumbers.at(-1) ?? 0;
  for (let dayNumber = 1; dayNumber < lastDayNumber; dayNumber++) {
    if (!existingDayNumbers.has(dayNumber)) {
      gaps.push({ dayNumber, kind: "gap" });
    }
  }

  // Those with a day first, in calendar order; then those still without one.
  const participantsWithoutTea: Array<EditionIssue> = participations
    .filter((participation) => !participation.hasTea)
    .toSorted(
      (first, second) => (first.dayNumber ?? Number.MAX_SAFE_INTEGER) - (second.dayNumber ?? Number.MAX_SAFE_INTEGER),
    )
    .map((participation) => ({
      dayNumber: participation.dayNumber,
      kind: "participantWithoutTea",
      name: toParticipantName(participation),
      participationId: participation.id,
    }));

  return [...enrolledWithoutDay, ...gaps, ...emptyDays, ...participantsWithoutTea];
}

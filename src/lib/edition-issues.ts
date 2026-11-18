import { type ParticipantNameSource, toParticipantName } from "./utils";

export type EditionDay = { dayNumber: number; hasTea: boolean };
export type EditionParticipation = ParticipantNameSource & { dayNumber: null | number; id: string };

export type EditionIssue =
  | { dayNumber: number; kind: "emptyDay" }
  | { dayNumber: number; kind: "gap" }
  | { dayNumber: number; kind: "participantWithoutTea"; name: null | string; participationId: string }
  | { dayNumber: number; kind: "teaWithoutOwner" }
  | { kind: "enrolledWithoutDay"; name: null | string; participationId: string };

/**
 * What an edition still lacks before it can open. Nothing here blocks: the manager decides.
 * The result is ordered by kind, most serious first, and by day number within a kind.
 */
export function findEditionIssues(
  days: ReadonlyArray<EditionDay>,
  participations: ReadonlyArray<EditionParticipation>,
): Array<EditionIssue> {
  const participationByDayNumber = new Map<number, EditionParticipation>();
  const enrolledWithoutDay: Array<EditionIssue> = [];
  for (const participation of participations) {
    if (participation.dayNumber === null) {
      enrolledWithoutDay.push({
        kind: "enrolledWithoutDay",
        name: toParticipantName(participation),
        participationId: participation.id,
      });
    } else {
      participationByDayNumber.set(participation.dayNumber, participation);
    }
  }

  const teasWithoutOwner: Array<EditionIssue> = [];
  const emptyDays: Array<EditionIssue> = [];
  const participantsWithoutTea: Array<EditionIssue> = [];
  const sortedDays = [...days].sort((first, second) => first.dayNumber - second.dayNumber);
  for (const { dayNumber, hasTea } of sortedDays) {
    const participation = participationByDayNumber.get(dayNumber);
    if (!participation) {
      // A tea nobody owns is the serious case, so that day is not also reported as empty.
      if (hasTea) {
        teasWithoutOwner.push({ dayNumber, kind: "teaWithoutOwner" });
      } else {
        emptyDays.push({ dayNumber, kind: "emptyDay" });
      }
    } else if (!hasTea) {
      participantsWithoutTea.push({
        dayNumber,
        kind: "participantWithoutTea",
        name: toParticipantName(participation),
        participationId: participation.id,
      });
    }
  }

  const gaps: Array<EditionIssue> = [];
  const existingDayNumbers = new Set(sortedDays.map((day) => day.dayNumber));
  const lastDayNumber = sortedDays.at(-1)?.dayNumber ?? 0;
  for (let dayNumber = 1; dayNumber < lastDayNumber; dayNumber++) {
    if (!existingDayNumbers.has(dayNumber)) {
      gaps.push({ dayNumber, kind: "gap" });
    }
  }

  return [...teasWithoutOwner, ...enrolledWithoutDay, ...gaps, ...emptyDays, ...participantsWithoutTea];
}

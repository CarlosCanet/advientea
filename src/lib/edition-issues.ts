import { type ParticipantNameSource, toParticipantName } from "./utils";

export type EditionDay = { dayNumber: number };
export type EditionParticipation = ParticipantNameSource & { dayNumber: null | number; hasTea: boolean; id: string };

export type EditionIssue =
  | { dayNumber: null | number; kind: "participantWithoutTea"; name: null | string; participationId: string }
  | { dayNumber: number; kind: "dayOutsideCalendar" }
  | { dayNumber: number; kind: "freeDay" }
  | { kind: "enrolledWithoutDay"; name: null | string; participationId: string };

/**
 * What an edition still lacks before it can open. Nothing here blocks: the manager decides.
 * An edition has as many days as participants: with N enrolled, its calendar is days 1..N, one each.
 * A day above N is outside the calendar, whoever holds it; a number in 1..N that nobody holds is free,
 * whether or not its Day row exists yet.
 * The result is ordered by kind, most serious first, and by day number within a kind.
 */
export function findEditionIssues(
  days: ReadonlyArray<EditionDay>,
  participations: ReadonlyArray<EditionParticipation>,
): Array<EditionIssue> {
  const participantCount = participations.length;
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

  // A held number counts even when `days` does not list its row.
  const dayNumbersOutsideCalendar = new Set(
    [...days.map((day) => day.dayNumber), ...heldDayNumbers].filter((dayNumber) => dayNumber > participantCount),
  );
  const daysOutsideCalendar: Array<EditionIssue> = [...dayNumbersOutsideCalendar]
    .sort((first, second) => first - second)
    .map((dayNumber) => ({ dayNumber, kind: "dayOutsideCalendar" }));

  const freeDays: Array<EditionIssue> = [];
  for (let dayNumber = 1; dayNumber <= participantCount; dayNumber++) {
    if (!heldDayNumbers.has(dayNumber)) {
      freeDays.push({ dayNumber, kind: "freeDay" });
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

  return [...daysOutsideCalendar, ...enrolledWithoutDay, ...freeDays, ...participantsWithoutTea];
}

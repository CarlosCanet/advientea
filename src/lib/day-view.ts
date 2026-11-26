import { EditionStatus } from "@/generated/prisma/enums";

import { type AdvienteaDayState, type EditionInfo, HOURS, toHourLabel } from "./advientea-rules";
import { toDateNumber, toEditionDate, toMadridDateTime } from "./advientea-time";

export interface RevealStep {
  hour: number;
  isNext: boolean;
  isReleased: boolean;
  label: string;
  title: string;
}

export type GuessCardState = "assignee" | "authorOnly" | "closed" | "noTea" | "open" | "signedOut";

export interface GuessCardInput {
  canGuessPerson: boolean;
  canGuessTea: boolean;
  hasTea: boolean;
  isAssignee: boolean;
  isSignedIn: boolean;
}

const MONTH_NAMES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/** The four moments of a day, in order; the first one not released yet is the next. */
export function getRevealSteps(state: AdvienteaDayState): RevealStep[] {
  const steps = [
    { hour: HOURS.PART1, isReleased: state.isPart1Released, title: "Parte 1" },
    { hour: HOURS.PART2, isReleased: state.isPart2Released, title: "Parte 2" },
    { hour: HOURS.PART3, isReleased: state.isPart3Released, title: "Parte 3" },
    { hour: HOURS.TEA, isReleased: state.isTeaReleased, title: "El té" },
  ];
  const nextIndex = steps.findIndex((step) => !step.isReleased);
  return steps.map((step, index) => ({ ...step, isNext: index === nextIndex, label: toHourLabel(step.hour) }));
}

/** What the guess card shows; the first rule that matches wins. */
export function getGuessCardState(input: GuessCardInput): GuessCardState {
  if (!input.isSignedIn) {
    return "signedOut";
  }
  if (!input.hasTea) {
    return "noTea";
  }
  if (input.isAssignee) {
    return "assignee";
  }
  if (input.canGuessTea) {
    return "open";
  }
  if (input.canGuessPerson) {
    return "authorOnly";
  }
  return "closed";
}

/** When day N opens, in Spanish: "Se abre el 1 de diciembre". A day opens at midnight, so no hour. */
export function toDayOpeningLabel(year: number, dayNumber: number): string {
  const date = toEditionDate(year, dayNumber);
  return `Se abre el ${date.day} de ${MONTH_NAMES[date.month - 1]}`;
}

/** The day of an active edition whose date is today in Madrid, or null when no day falls today. */
export function getTodayDayNumber(edition: EditionInfo, now: Date): null | number {
  if (edition.status !== EditionStatus.ACTIVE) {
    return null;
  }
  const today = toDateNumber(toMadridDateTime(now));
  for (let dayNumber = 1; dayNumber <= edition.lastDayNumber; dayNumber++) {
    if (toDateNumber(toEditionDate(edition.year, dayNumber)) === today) {
      return dayNumber;
    }
  }
  return null;
}

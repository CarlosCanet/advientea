import { EditionStatus, Role } from "@/generated/prisma/enums";

import { getNow, toDateNumber, toEditionDate, toMadridDateTime } from "./advientea-time";

export interface AdvienteaDayState {
  isPart1Released: boolean;
  isPart2Released: boolean;
  isPart3Released: boolean;
  isPersonNameReleased: boolean;
  isReleased: boolean;
  isTeaReleased: boolean;
}

export type EditionInfo = {
  lastDayNumber: number;
  status: EditionStatus;
  year: number;
};

const HOURS = {
  NAME: 20,
  PART1: 7,
  PART2: 13,
  PART3: 18,
  TEA: 20,
};

function allFlags(value: boolean): AdvienteaDayState {
  return {
    isPart1Released: value,
    isPart2Released: value,
    isPart3Released: value,
    isPersonNameReleased: value,
    isReleased: value,
    isTeaReleased: value,
  };
}

function gatesAt(hour: number) {
  return {
    isPart1Released: hour >= HOURS.PART1,
    isPart2Released: hour >= HOURS.PART2,
    isPart3Released: hour >= HOURS.PART3,
    isTeaReleased: hour >= HOURS.TEA,
  };
}

/** The calendar alone: what day N of the edition has released at `now`, whoever is looking. */
export function getDaySchedule(dayNumber: number, edition: EditionInfo, now: Date): AdvienteaDayState {
  if (edition.status === EditionStatus.ARCHIVED) {
    return allFlags(true);
  }
  if (edition.status === EditionStatus.PREPARING) {
    return allFlags(false);
  }
  const madrid = toMadridDateTime(now);
  const today = toDateNumber(madrid);
  const day = toDateNumber(toEditionDate(edition.year, dayNumber));
  const lastDay = toDateNumber(toEditionDate(edition.year, edition.lastDayNumber));
  const isPersonNameReleased = today > lastDay || (today === lastDay && madrid.hour >= HOURS.NAME);

  if (today < day) {
    return { ...allFlags(false), isPersonNameReleased };
  }
  if (today > day) {
    return { ...allFlags(true), isPersonNameReleased };
  }
  return { isReleased: true, ...gatesAt(madrid.hour), isPersonNameReleased };
}

/** The calendar as a viewer sees it: anonymous visitors never get names, calendar managers may simulate. */
export function getAdvienteaDayState(
  dayNumber: number,
  edition: EditionInfo,
  userRole: Role | undefined,
  isSimulated = false,
  now = getNow(),
): AdvienteaDayState {
  let base = getDaySchedule(dayNumber, edition, now);
  if (
    isSimulated &&
    edition.status !== EditionStatus.ARCHIVED &&
    (userRole === Role.ADMIN || userRole === Role.EXECUTEAVE)
  ) {
    base = { ...base, isReleased: true, ...gatesAt(toMadridDateTime(now).hour) };
  }
  if (!userRole) {
    base = { ...base, isPersonNameReleased: false };
  }
  return base;
}

/** Who may change a tea: admins always, managers any tea of an edition not archived, users only their own there. */
export function canEditTea(role: Role | undefined, tea: { editionStatus: EditionStatus; isOwn: boolean }): boolean {
  if (role === Role.ADMIN) {
    return true;
  }
  const isOpen = tea.editionStatus !== EditionStatus.ARCHIVED;
  if (role === Role.EXECUTEAVE) {
    return isOpen;
  }
  if (role === Role.USER) {
    return isOpen && tea.isOwn;
  }
  return false;
}

import { Role } from "@/generated/prisma/enums";

export interface AdvienteaDayState {
  isReleased: boolean;
  isPart1Released: boolean;
  isPart2Released: boolean;
  isPart3Released: boolean;
  isPersonNameReleased: boolean;
  isTeaReleased: boolean;
}

function getToday(): Date {
  const today = new Date().getTime();
  const TIME_OFFSET_HOURS = 1;
  return new Date(today + TIME_OFFSET_HOURS * 3600000);
}

export function isDatePast(targetDate: Date): boolean {
  const today = getToday();
  today.setHours(0, 0, 0, 0);
  const target = new Date(targetDate);
  target.setHours(0, 0, 0, 0);
  return today > target;
}

export function isDateTodayOrPast(targetDate: Date): boolean {
  const today = getToday();
  today.setHours(0, 0, 0, 0);
  const target = new Date(targetDate);
  target.setHours(0, 0, 0, 0);
  return today >= target;
}

export function getAdvienteaDayState(dayNumber: number, year: number, userRole: Role, isSimulated = false): AdvienteaDayState {
  const HOURS = {
    PART1: 7,
    PART2: 13,
    PART3: 18,
    TEA: 20,
    NAME: 20,
  };
  const RELEASE_NAME_DAY = new Date(year, 11, 21);

  const state: AdvienteaDayState = {
    isReleased: false,
    isPart1Released: false,
    isPart2Released: false,
    isPart3Released: false,
    isPersonNameReleased: false,
    isTeaReleased: false,
  };

  const today = getToday();
  const currentHour = today.getHours();
  const teaDate = new Date(year, 11, dayNumber);

  const isExec = userRole === Role.ADMIN || userRole === Role.EXECUTEAVE;
  const canBeSimulated = today > teaDate || isExec;

  const effectiveDate = canBeSimulated && isSimulated ? today : teaDate;

  const isDayReached = today >= effectiveDate;
  const isPastDate = isDatePast(effectiveDate);
  
  state.isReleased = isDayReached;
  
  if (isPastDate && !isSimulated) {
    state.isPart1Released = true;
    state.isPart2Released = true;
    state.isPart3Released = true;
    state.isTeaReleased = true;
  } else {
    state.isPart1Released = currentHour >= HOURS.PART1;
    state.isPart2Released = currentHour >= HOURS.PART2;
    state.isPart3Released = currentHour >= HOURS.PART3;
    state.isTeaReleased = currentHour >= HOURS.TEA;
  }

  state.isPersonNameReleased = isDatePast(RELEASE_NAME_DAY) || (isDateTodayOrPast(RELEASE_NAME_DAY) && currentHour >= HOURS.NAME);

  return state;
}
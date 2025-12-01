import { Role } from "@/generated/prisma/enums";

export interface AdvienteaDayState {
  isReleased: boolean;
  isPart1Released: boolean;
  isPart2Released: boolean;
  isPart3Released: boolean;
  isPersonNameReleased: boolean;
  isTeaReleased: boolean;
}

export function isDatePast(targetDate: Date): boolean{
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  targetDate.setHours(0, 0, 0, 0);
  return today > targetDate;
}

export function isDateTodayOrPast(targetDate: Date): boolean{
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  targetDate.setHours(0, 0, 0, 0);
  return today >= targetDate;
}

export function getAdvienteaDayState(dayNumber: number, year: number, userRole: Role, isSimulated = false): AdvienteaDayState {
  const HOURS = {
    PART1: 8,
    PART2: 11,
    PART3: 18,
    TEA: 20,
    NAME: 20
  };
  
  const today = new Date();
  const teaDate = new Date(year, 11, dayNumber);
  
  const isExec = userRole === Role.ADMIN || userRole === Role.EXECUTEAVE;
  const canBeSimulated = today > teaDate || isExec;
  
  const effectiveDate = (canBeSimulated && isSimulated) ? today : teaDate;
  
  const isDayReached = today >= effectiveDate;
  const isReleased = isExec || isDayReached;

  if (!isReleased) {
    return { 
      isReleased: false, isPart1Released: false, isPart2Released: false, 
      isPart3Released: false, isPersonNameReleased: false, isTeaReleased: false 
    };
  }

  const currentHour = (today.getUTCHours() + 1) % 24;
  const isTodayOrPastDate = isDatePast(new Date(year, 11, dayNumber));
  
  if (isTodayOrPastDate && !isSimulated) {
    return { 
      isReleased: true, isPart1Released: true, isPart2Released: true, 
      isPart3Released: true, isPersonNameReleased: true, isTeaReleased: true 
    };
  }

  return {
    isReleased: true,
    isPart1Released: currentHour >= HOURS.PART1,
    isPart2Released: currentHour >= HOURS.PART2,
    isPart3Released: currentHour >= HOURS.PART3,
    isTeaReleased: currentHour >= HOURS.TEA,
    isPersonNameReleased: isDatePast(new Date(year, 11, 21)) && currentHour >= HOURS.NAME,
  };
}
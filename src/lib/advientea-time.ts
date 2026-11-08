export interface MadridDateTime {
  day: number;
  hour: number;
  minute: number;
  month: number;
  year: number;
}

/** The clock every rule reads. ADVIENTEA_FAKE_NOW moves it for the staging rehearsal; production never looks at it. */
export function getNow(): Date {
  if (process.env.ADVIENTEA_FAKE_NOW && process.env.VERCEL_ENV !== "production") {
    const raw = process.env.ADVIENTEA_FAKE_NOW;
    // Without an offset the host would read it as UTC: on Vercel that is one hour off Madrid.
    if (!/(Z|[+-]\d{2}:\d{2})$/.test(raw)) {
      throw new Error(`ADVIENTEA_FAKE_NOW must include a UTC offset, e.g. 2026-12-03T07:30:00+01:00; got ${raw}`);
    }
    const fakeNow = new Date(raw);
    if (Number.isNaN(fakeNow.getTime())) {
      throw new Error(`Invalid ADVIENTEA_FAKE_NOW date: ${raw}`);
    }
    return fakeNow;
  }
  return new Date();
}

/** Wall-clock date and time of `date` in Madrid: the only clock the calendar rules care about. */
export function toMadridDateTime(date: Date): MadridDateTime {
  const parts = Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    hour: "numeric",
    hourCycle: "h23",
    minute: "numeric",
    month: "numeric",
    timeZone: "Europe/Madrid",
    year: "numeric",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes): number => {
    const value = parts.find((p) => p.type === type)?.value;
    if (value === undefined) {
      throw new Error(`Date part "${type}" missing when formatting ${date.toISOString()}`);
    }
    return Number(value);
  };
  return { day: part("day"), hour: part("hour"), minute: part("minute"), month: part("month"), year: part("year") };
}

/** A calendar date as the integer YYYYMMDD: two Madrid dates compare with `<` and `===`, no Date objects involved. */
export function toDateNumber(date: Pick<MadridDateTime, "day" | "month" | "year">): number {
  return date.year * 10000 + date.month * 100 + date.day;
}

/** The calendar date of day N of the edition, into January past the 31st: UTC in and out because it is a date, not an instant. */
export function toEditionDate(year: number, dayNumber: number): { day: number; month: number; year: number } {
  const date = new Date(Date.UTC(year, 11, dayNumber));
  return { day: date.getUTCDate(), month: date.getUTCMonth() + 1, year: date.getUTCFullYear() };
}

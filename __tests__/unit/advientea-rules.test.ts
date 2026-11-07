import { afterEach, describe, expect, it, vi } from "vitest";

import { EditionStatus, Role } from "@/generated/prisma/enums";
import { type AdvienteaDayState, type EditionInfo, getAdvienteaDayState, getDaySchedule } from "@/lib/advientea-rules";
import { getNow, toMadridDateTime } from "@/lib/advientea-time";
import { calculateTimeScore } from "@/lib/tea-guess-scoring";

// December (and mid November) are outside DST, so Madrid is UTC+1 in every case below.
const MADRID_WINTER_OFFSET = "+01:00";

/** Builds an instant from a Madrid wall-clock time, e.g. madrid("2026-12-03", "06:59"). */
function madrid(date: string, time: string): Date {
  return new Date(`${date}T${time}:00${MADRID_WINTER_OFFSET}`);
}

function edition(status: EditionStatus, year: number, lastDayNumber: number): EditionInfo {
  return { lastDayNumber, status, year };
}

function state(overrides: Partial<AdvienteaDayState> = {}): AdvienteaDayState {
  return {
    isPart1Released: false,
    isPart2Released: false,
    isPart3Released: false,
    isPersonNameReleased: false,
    isReleased: false,
    isTeaReleased: false,
    ...overrides,
  };
}

const allFalse = state();
const allTrue = state({
  isPart1Released: true,
  isPart2Released: true,
  isPart3Released: true,
  isPersonNameReleased: true,
  isReleased: true,
  isTeaReleased: true,
});
const everythingButNames = state({
  isPart1Released: true,
  isPart2Released: true,
  isPart3Released: true,
  isReleased: true,
  isTeaReleased: true,
});

const active2026 = edition(EditionStatus.ACTIVE, 2026, 23);
const preparing2026 = edition(EditionStatus.PREPARING, 2026, 23);
const archived2025 = edition(EditionStatus.ARCHIVED, 2025, 22);

describe("toMadridDateTime", () => {
  it("maps a UTC instant to the Madrid wall-clock parts", () => {
    const parts = toMadridDateTime(new Date("2026-12-03T06:00:00Z"));

    expect(parts).toMatchObject({ day: 3, hour: 7, minute: 0, month: 12, year: 2026 });
  });

  it("follows summer time: 06:00Z is 08:00 in Madrid in July", () => {
    expect(toMadridDateTime(new Date("2026-07-03T06:00:00Z"))).toMatchObject({ day: 3, hour: 8, month: 7 });
  });

  it("reports the next calendar day for an instant just before midnight UTC", () => {
    const parts = toMadridDateTime(new Date("2026-12-02T23:30:00Z"));

    expect(parts).toMatchObject({ day: 3, hour: 0, minute: 30, month: 12, year: 2026 });
  });
});

describe("getNow", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns the fake date when ADVIENTEA_FAKE_NOW is set outside production", () => {
    vi.stubEnv("ADVIENTEA_FAKE_NOW", "2026-12-03T10:00:00+01:00");
    vi.stubEnv("VERCEL_ENV", undefined);

    expect(getNow().toISOString()).toBe(new Date("2026-12-03T10:00:00+01:00").toISOString());
  });

  it("ignores ADVIENTEA_FAKE_NOW when VERCEL_ENV is production", () => {
    vi.stubEnv("ADVIENTEA_FAKE_NOW", "2026-12-03T10:00:00+01:00");
    vi.stubEnv("VERCEL_ENV", "production");

    const before = Date.now();
    const now = getNow();
    const after = Date.now();

    expect(now.getTime()).toBeGreaterThanOrEqual(before);
    expect(now.getTime()).toBeLessThanOrEqual(after);
  });

  it("throws when ADVIENTEA_FAKE_NOW has no UTC offset, so it cannot be misread as UTC on the host", () => {
    vi.stubEnv("ADVIENTEA_FAKE_NOW", "2026-12-03T07:30:00");
    vi.stubEnv("VERCEL_ENV", undefined);

    expect(() => getNow()).toThrow(/offset/);
  });

  it("throws when ADVIENTEA_FAKE_NOW is not a parseable date", () => {
    vi.stubEnv("ADVIENTEA_FAKE_NOW", "not a date");
    vi.stubEnv("VERCEL_ENV", undefined);

    expect(() => getNow()).toThrow(/ADVIENTEA_FAKE_NOW/);
  });

  it("returns the current date when ADVIENTEA_FAKE_NOW is unset", () => {
    vi.stubEnv("ADVIENTEA_FAKE_NOW", undefined);
    vi.stubEnv("VERCEL_ENV", undefined);

    const before = Date.now();
    const now = getNow();
    const after = Date.now();

    expect(now.getTime()).toBeGreaterThanOrEqual(before);
    expect(now.getTime()).toBeLessThanOrEqual(after);
  });
});

describe("getDaySchedule", () => {
  describe("active edition, day 3 of 2026", () => {
    it("releases nothing the day before", () => {
      expect(getDaySchedule(3, active2026, madrid("2026-12-02", "23:59"))).toEqual(allFalse);
    });

    it("marks the day released without parts at 06:59", () => {
      expect(getDaySchedule(3, active2026, madrid("2026-12-03", "06:59"))).toEqual(state({ isReleased: true }));
    });

    it("releases part 1 only at 07:00", () => {
      expect(getDaySchedule(3, active2026, madrid("2026-12-03", "07:00"))).toEqual(
        state({ isPart1Released: true, isReleased: true }),
      );
    });

    it("keeps part 2 closed at 12:59", () => {
      expect(getDaySchedule(3, active2026, madrid("2026-12-03", "12:59"))).toEqual(
        state({ isPart1Released: true, isReleased: true }),
      );
    });

    it("releases part 2 at 13:00", () => {
      expect(getDaySchedule(3, active2026, madrid("2026-12-03", "13:00"))).toEqual(
        state({ isPart1Released: true, isPart2Released: true, isReleased: true }),
      );
    });

    it("keeps part 3 closed at 17:59", () => {
      expect(getDaySchedule(3, active2026, madrid("2026-12-03", "17:59"))).toEqual(
        state({ isPart1Released: true, isPart2Released: true, isReleased: true }),
      );
    });

    it("releases part 3 at 18:00", () => {
      expect(getDaySchedule(3, active2026, madrid("2026-12-03", "18:00"))).toEqual(
        state({ isPart1Released: true, isPart2Released: true, isPart3Released: true, isReleased: true }),
      );
    });

    it("keeps the tea closed at 19:59", () => {
      expect(getDaySchedule(3, active2026, madrid("2026-12-03", "19:59"))).toEqual(
        state({ isPart1Released: true, isPart2Released: true, isPart3Released: true, isReleased: true }),
      );
    });

    it("releases the tea at 20:00", () => {
      expect(getDaySchedule(3, active2026, madrid("2026-12-03", "20:00"))).toEqual(everythingButNames);
    });

    it("releases everything but the names the day after at 00:00", () => {
      expect(getDaySchedule(3, active2026, madrid("2026-12-04", "00:00"))).toEqual(everythingButNames);
    });

    it("treats 06:00Z as 07:00 in Madrid and releases part 1", () => {
      expect(getDaySchedule(3, active2026, new Date("2026-12-03T06:00:00Z"))).toEqual(
        state({ isPart1Released: true, isReleased: true }),
      );
    });

    it("treats 05:59Z as 06:59 in Madrid and keeps part 1 closed", () => {
      expect(getDaySchedule(3, active2026, new Date("2026-12-03T05:59:00Z"))).toEqual(state({ isReleased: true }));
    });
  });

  describe("participant names", () => {
    it("keeps the names hidden on the last day at 19:59", () => {
      expect(getDaySchedule(23, active2026, madrid("2026-12-23", "19:59")).isPersonNameReleased).toBe(false);
    });

    it("reveals the names on the last day at 20:00", () => {
      expect(getDaySchedule(23, active2026, madrid("2026-12-23", "20:00")).isPersonNameReleased).toBe(true);
    });

    it("keeps the names revealed after the last day", () => {
      expect(getDaySchedule(23, active2026, madrid("2026-12-24", "10:00")).isPersonNameReleased).toBe(true);
      expect(getDaySchedule(3, active2026, madrid("2026-12-24", "10:00")).isPersonNameReleased).toBe(true);
    });

    it("does not reveal the names at 20:00 of a day that is not the last one", () => {
      expect(getDaySchedule(3, active2026, madrid("2026-12-03", "20:00")).isPersonNameReleased).toBe(false);
    });
  });

  describe("days beyond December", () => {
    // More than 31 participants: day 32 is 1 January of the next year and the calendar carries on.
    const active35Days = edition(EditionStatus.ACTIVE, 2026, 35);

    it("keeps day 3 on 3 December, whatever the length of the edition", () => {
      expect(getDaySchedule(3, active35Days, madrid("2026-12-03", "07:00"))).toEqual(
        state({ isPart1Released: true, isReleased: true }),
      );
    });

    it("keeps day 32 closed on 31 December at 23:59", () => {
      expect(getDaySchedule(32, active35Days, madrid("2026-12-31", "23:59"))).toEqual(allFalse);
    });

    it("opens day 32 on 1 January without parts at 06:59", () => {
      expect(getDaySchedule(32, active35Days, madrid("2027-01-01", "06:59"))).toEqual(state({ isReleased: true }));
    });

    it("releases part 1 of day 35 on 4 January at 07:00", () => {
      expect(getDaySchedule(35, active35Days, madrid("2027-01-04", "07:00"))).toEqual(
        state({ isPart1Released: true, isReleased: true }),
      );
    });

    it("reveals the names on 4 January at 20:00 when day 35 is the last one", () => {
      expect(getDaySchedule(35, active35Days, madrid("2027-01-04", "19:59")).isPersonNameReleased).toBe(false);
      expect(getDaySchedule(35, active35Days, madrid("2027-01-04", "20:00")).isPersonNameReleased).toBe(true);
      expect(getDaySchedule(3, active35Days, madrid("2027-01-05", "10:00"))).toEqual(allTrue);
    });
  });

  describe("edition status", () => {
    it("releases everything for an archived edition whatever the date", () => {
      expect(getDaySchedule(3, archived2025, madrid("2026-11-15", "10:00"))).toEqual(allTrue);
    });

    it("releases everything for an archived edition even before its own dates, by status alone", () => {
      const archivedFuture = edition(EditionStatus.ARCHIVED, 2026, 23);

      expect(getDaySchedule(3, archivedFuture, madrid("2026-11-15", "10:00"))).toEqual(allTrue);
      expect(getDaySchedule(3, archived2025, madrid("2025-12-03", "10:00"))).toEqual(allTrue);
    });

    it("releases nothing for a preparing edition even after the tea hour of the day", () => {
      expect(getDaySchedule(3, preparing2026, madrid("2026-12-03", "21:00"))).toEqual(allFalse);
    });
  });
});

describe("getAdvienteaDayState", () => {
  const afterLastDay = madrid("2026-12-24", "10:00");

  it("never reveals the names to an anonymous visitor", () => {
    expect(getAdvienteaDayState(3, active2026, undefined, false, afterLastDay)).toEqual(everythingButNames);
  });

  it("reveals the names to a signed-in user after the last day", () => {
    expect(getAdvienteaDayState(3, active2026, Role.USER, false, afterLastDay)).toEqual(allTrue);
  });

  it("ignores simulation for a user on a future day", () => {
    expect(getAdvienteaDayState(3, active2026, Role.USER, true, madrid("2026-11-15", "13:30"))).toEqual(allFalse);
  });

  it("lets a calendar manager simulate a preparing edition following the current Madrid hour", () => {
    expect(getAdvienteaDayState(3, preparing2026, Role.EXECUTEAVE, true, madrid("2026-11-15", "13:30"))).toEqual(
      state({ isPart1Released: true, isPart2Released: true, isReleased: true }),
    );
  });

  it("does not change the names flag when an admin simulates", () => {
    const beforeLastDay = madrid("2026-12-10", "21:00");

    expect(getAdvienteaDayState(15, active2026, Role.ADMIN, true, beforeLastDay)).toEqual(everythingButNames);
    // A past day simulated at 10:00 follows the current hour like any other: only part 1 is open.
    expect(getAdvienteaDayState(3, active2026, Role.ADMIN, true, afterLastDay)).toEqual(
      state({ isPart1Released: true, isPersonNameReleased: true, isReleased: true }),
    );
  });

  it("does not let an admin simulate an archived edition whose dates have not come yet", () => {
    const archivedFuture = edition(EditionStatus.ARCHIVED, 2026, 23);

    expect(getAdvienteaDayState(3, archivedFuture, Role.ADMIN, true, madrid("2026-11-15", "06:00"))).toEqual(allTrue);
  });

  it("keeps everything released when an admin simulates an archived edition", () => {
    expect(getAdvienteaDayState(3, archived2025, Role.ADMIN, true, madrid("2026-11-15", "06:00"))).toEqual(allTrue);
  });
});

describe("calculateTimeScore", () => {
  it("gives the full score before 10:00 Madrid", () => {
    expect(calculateTimeScore(madrid("2026-12-03", "09:59"))).toBe(200);
  });

  it("gives the full score at 10:00 Madrid", () => {
    expect(calculateTimeScore(madrid("2026-12-03", "10:00"))).toBe(200);
  });

  it("gives half the score at 15:00 Madrid", () => {
    expect(calculateTimeScore(madrid("2026-12-03", "15:00"))).toBe(100);
  });

  it("gives no score at 20:00 Madrid", () => {
    expect(calculateTimeScore(madrid("2026-12-03", "20:00"))).toBe(0);
  });

  it("gives no score at 23:00 Madrid", () => {
    expect(calculateTimeScore(madrid("2026-12-03", "23:00"))).toBe(0);
  });

  it("uses the Madrid hour, not the machine's local hour", () => {
    expect(calculateTimeScore(new Date("2026-12-03T14:00:00Z"))).toBe(100);
  });
});

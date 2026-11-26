import { describe, expect, it } from "vitest";

import { EditionStatus } from "@/generated/prisma/enums";
import { type AdvienteaDayState, type EditionInfo } from "@/lib/advientea-rules";
import {
  getGuessCardState,
  getRevealSteps,
  getTodayDayNumber,
  type GuessCardInput,
  type GuessCardState,
  type RevealStep,
  toDayOpeningLabel,
} from "@/lib/day-view";

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

function edition(status: EditionStatus, year: number, lastDayNumber: number): EditionInfo {
  return { lastDayNumber, status, year };
}

function guessInput(overrides: Partial<GuessCardInput> = {}): GuessCardInput {
  return {
    canGuessPerson: false,
    canGuessTea: false,
    hasTea: true,
    isAssignee: false,
    isSignedIn: true,
    ...overrides,
  };
}

const STEP_SHAPES = [
  { hour: 7, label: "07:00", title: "Parte 1" },
  { hour: 13, label: "13:00", title: "Parte 2" },
  { hour: 18, label: "18:00", title: "Parte 3" },
  { hour: 20, label: "20:00", title: "El té" },
];

function released(steps: RevealStep[]): boolean[] {
  return steps.map((step) => step.isReleased);
}

function next(steps: RevealStep[]): boolean[] {
  return steps.map((step) => step.isNext);
}

describe("getRevealSteps", () => {
  it("always returns the four steps in order with their hours, labels and titles", () => {
    const steps = getRevealSteps(state());

    expect(steps).toHaveLength(4);
    expect(steps.map(({ hour, label, title }) => ({ hour, label, title }))).toEqual(STEP_SHAPES);
  });

  it("returns the same hours, labels and titles whatever the state", () => {
    const steps = getRevealSteps(
      state({
        isPart1Released: true,
        isPart2Released: true,
        isPart3Released: true,
        isPersonNameReleased: true,
        isReleased: true,
        isTeaReleased: true,
      }),
    );

    expect(steps.map(({ hour, label, title }) => ({ hour, label, title }))).toEqual(STEP_SHAPES);
  });

  it("marks the first step as next when nothing is released", () => {
    const steps = getRevealSteps(state());

    expect(released(steps)).toEqual([false, false, false, false]);
    expect(next(steps)).toEqual([true, false, false, false]);
  });

  it("marks the second step as next when only part 1 is released", () => {
    const steps = getRevealSteps(state({ isPart1Released: true, isReleased: true }));

    expect(released(steps)).toEqual([true, false, false, false]);
    expect(next(steps)).toEqual([false, true, false, false]);
  });

  it("marks the third step as next when parts 1 and 2 are released", () => {
    const steps = getRevealSteps(state({ isPart1Released: true, isPart2Released: true, isReleased: true }));

    expect(released(steps)).toEqual([true, true, false, false]);
    expect(next(steps)).toEqual([false, false, true, false]);
  });

  it("marks the tea step as next when the three parts are released", () => {
    const steps = getRevealSteps(
      state({ isPart1Released: true, isPart2Released: true, isPart3Released: true, isReleased: true }),
    );

    expect(released(steps)).toEqual([true, true, true, false]);
    expect(next(steps)).toEqual([false, false, false, true]);
  });

  it("marks no step as next when everything is released", () => {
    const steps = getRevealSteps(
      state({
        isPart1Released: true,
        isPart2Released: true,
        isPart3Released: true,
        isPersonNameReleased: true,
        isReleased: true,
        isTeaReleased: true,
      }),
    );

    expect(released(steps)).toEqual([true, true, true, true]);
    expect(next(steps)).toEqual([false, false, false, false]);
  });

  it("copies each flag as given in an inconsistent state and marks the first unreleased step as next", () => {
    const steps = getRevealSteps(state({ isPart1Released: false, isPart2Released: true, isTeaReleased: true }));

    expect(released(steps)).toEqual([false, true, false, true]);
    expect(next(steps)).toEqual([true, false, false, false]);
  });

  it("picks the earliest gap as next when a later step is released past it", () => {
    const steps = getRevealSteps(state({ isPart1Released: true, isPart3Released: true, isTeaReleased: true }));

    expect(released(steps)).toEqual([true, false, true, true]);
    expect(next(steps)).toEqual([false, true, false, false]);
  });

  it("ignores isReleased and isPersonNameReleased", () => {
    const steps = getRevealSteps(state({ isPersonNameReleased: true, isReleased: true }));

    expect(released(steps)).toEqual([false, false, false, false]);
    expect(next(steps)).toEqual([true, false, false, false]);
  });

  it("marks at most one step as next for every combination of flags", () => {
    for (let mask = 0; mask < 16; mask++) {
      const flags = [0, 1, 2, 3].map((bit) => (mask & (1 << bit)) !== 0);
      const steps = getRevealSteps(
        state({
          isPart1Released: flags[0],
          isPart2Released: flags[1],
          isPart3Released: flags[2],
          isTeaReleased: flags[3],
        }),
      );
      const firstUnreleased = flags.indexOf(false);

      expect(released(steps)).toEqual(flags);
      expect(next(steps)).toEqual(flags.map((_, index) => index === firstUnreleased));
    }
  });
});

describe("getGuessCardState", () => {
  it("is signedOut when the viewer is not signed in", () => {
    expect(getGuessCardState(guessInput({ isSignedIn: false }))).toBe("signedOut");
  });

  it("is signedOut before anything else, even with no tea, as assignee and with guesses open", () => {
    expect(
      getGuessCardState({
        canGuessPerson: true,
        canGuessTea: true,
        hasTea: false,
        isAssignee: true,
        isSignedIn: false,
      }),
    ).toBe("signedOut");
  });

  it("is noTea when the day has no tea", () => {
    expect(getGuessCardState(guessInput({ hasTea: false }))).toBe("noTea");
  });

  it("is noTea before assignee and open guesses", () => {
    expect(
      getGuessCardState(guessInput({ canGuessPerson: true, canGuessTea: true, hasTea: false, isAssignee: true })),
    ).toBe("noTea");
  });

  it("is assignee when the viewer holds the day", () => {
    expect(getGuessCardState(guessInput({ isAssignee: true }))).toBe("assignee");
  });

  it("is assignee before open guesses", () => {
    expect(getGuessCardState(guessInput({ canGuessPerson: true, canGuessTea: true, isAssignee: true }))).toBe(
      "assignee",
    );
  });

  it("is open when the tea can be guessed and the author cannot", () => {
    expect(getGuessCardState(guessInput({ canGuessTea: true }))).toBe("open");
  });

  it("is open when both the tea and the author can be guessed", () => {
    expect(getGuessCardState(guessInput({ canGuessPerson: true, canGuessTea: true }))).toBe("open");
  });

  it("is authorOnly when only the author can be guessed", () => {
    expect(getGuessCardState(guessInput({ canGuessPerson: true }))).toBe("authorOnly");
  });

  it("is closed when nothing can be guessed", () => {
    expect(getGuessCardState(guessInput())).toBe("closed");
  });

  it("follows the precedence order for every combination of inputs", () => {
    const expected = (input: GuessCardInput): GuessCardState => {
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
    };

    for (let mask = 0; mask < 32; mask++) {
      const input: GuessCardInput = {
        canGuessPerson: (mask & 1) !== 0,
        canGuessTea: (mask & 2) !== 0,
        hasTea: (mask & 4) !== 0,
        isAssignee: (mask & 8) !== 0,
        isSignedIn: (mask & 16) !== 0,
      };

      expect(getGuessCardState(input), JSON.stringify(input)).toBe(expected(input));
    }
  });
});

describe("toDayOpeningLabel", () => {
  it("opens day 1 on 1 December, with no hour", () => {
    expect(toDayOpeningLabel(2026, 1)).toBe("Se abre el 1 de diciembre");
  });

  it("opens day 24 on 24 December", () => {
    expect(toDayOpeningLabel(2026, 24)).toBe("Se abre el 24 de diciembre");
  });

  it("opens day 25 on 25 December", () => {
    expect(toDayOpeningLabel(2026, 25)).toBe("Se abre el 25 de diciembre");
  });

  it("opens day 31 on 31 December", () => {
    expect(toDayOpeningLabel(2026, 31)).toBe("Se abre el 31 de diciembre");
  });

  it("rolls day 32 into 1 January", () => {
    expect(toDayOpeningLabel(2026, 32)).toBe("Se abre el 1 de enero");
  });

  it("rolls day 40 into 9 January, with no leading zero", () => {
    expect(toDayOpeningLabel(2026, 40)).toBe("Se abre el 9 de enero");
  });

  it("writes single-digit December days without a leading zero", () => {
    expect(toDayOpeningLabel(2026, 5)).toBe("Se abre el 5 de diciembre");
  });

  it("carries no hour, no year and no trailing punctuation", () => {
    const label = toDayOpeningLabel(2026, 1);

    expect(label).not.toMatch(/\d{1,2}:\d{2}/);
    expect(label).not.toContain("2026");
    expect(label).toMatch(/[a-z]$/);
  });

  it("gives the same label in another edition year", () => {
    expect(toDayOpeningLabel(2025, 1)).toBe("Se abre el 1 de diciembre");
    expect(toDayOpeningLabel(2027, 33)).toBe("Se abre el 2 de enero");
  });
});

describe("getTodayDayNumber", () => {
  const active25 = edition(EditionStatus.ACTIVE, 2026, 25);
  const active33 = edition(EditionStatus.ACTIVE, 2026, 33);

  it("is 1 at 00:30 Madrid on 1 December, still 30 November in UTC", () => {
    expect(getTodayDayNumber(active25, new Date("2026-11-30T23:30:00Z"))).toBe(1);
  });

  it("is null at 23:59 Madrid on 30 November", () => {
    expect(getTodayDayNumber(active25, new Date("2026-11-30T22:59:00Z"))).toBeNull();
  });

  it("is 1 at 23:59 Madrid on 1 December", () => {
    expect(getTodayDayNumber(active25, new Date("2026-12-01T22:59:00Z"))).toBe(1);
  });

  it("is 2 at midnight Madrid on 2 December, still 1 December in UTC", () => {
    expect(getTodayDayNumber(active25, new Date("2026-12-01T23:00:00Z"))).toBe(2);
  });

  it("uses the winter offset of +01:00 in December, not the summer +02:00", () => {
    // 23:30 Madrid on 1 December; a +02:00 reading would already be 2 December.
    expect(getTodayDayNumber(active25, new Date("2026-12-01T22:30:00Z"))).toBe(1);
    expect(getTodayDayNumber(active25, new Date("2026-12-10T12:00:00+01:00"))).toBe(10);
  });

  it("does not depend on the hour of the day", () => {
    expect(getTodayDayNumber(active25, new Date("2026-12-05T00:00:00+01:00"))).toBe(5);
    expect(getTodayDayNumber(active25, new Date("2026-12-05T06:59:00+01:00"))).toBe(5);
    expect(getTodayDayNumber(active25, new Date("2026-12-05T20:00:00+01:00"))).toBe(5);
  });

  it("is the last day on its own date", () => {
    expect(getTodayDayNumber(active25, new Date("2026-12-25T12:00:00+01:00"))).toBe(25);
  });

  it("is null on 26 December when the last day is 25", () => {
    expect(getTodayDayNumber(active25, new Date("2026-12-26T00:00:00+01:00"))).toBeNull();
  });

  it("is null in January when the last day is 25", () => {
    expect(getTodayDayNumber(active25, new Date("2027-01-02T12:00:00+01:00"))).toBeNull();
  });

  it("counts into January when the last day goes past the 31st", () => {
    expect(getTodayDayNumber(active33, new Date("2026-12-31T12:00:00+01:00"))).toBe(31);
    expect(getTodayDayNumber(active33, new Date("2027-01-01T00:00:00+01:00"))).toBe(32);
    expect(getTodayDayNumber(active33, new Date("2027-01-02T12:00:00+01:00"))).toBe(33);
  });

  it("is 32 at midnight Madrid on 1 January, still 31 December in UTC", () => {
    expect(getTodayDayNumber(active33, new Date("2026-12-31T23:30:00Z"))).toBe(32);
  });

  it("is null the day after a last day in January", () => {
    expect(getTodayDayNumber(active33, new Date("2027-01-03T00:00:00+01:00"))).toBeNull();
  });

  it("is null in December of another year", () => {
    expect(getTodayDayNumber(active25, new Date("2025-12-05T12:00:00+01:00"))).toBeNull();
    expect(getTodayDayNumber(active25, new Date("2027-12-05T12:00:00+01:00"))).toBeNull();
  });

  it("is null in summer, when Madrid is +02:00", () => {
    expect(getTodayDayNumber(active25, new Date("2026-07-01T12:00:00+02:00"))).toBeNull();
  });

  it("is null before 1 December", () => {
    expect(getTodayDayNumber(active25, new Date("2026-11-15T12:00:00+01:00"))).toBeNull();
  });

  it("is null while the edition is PREPARING, even on a calendar day", () => {
    expect(
      getTodayDayNumber(edition(EditionStatus.PREPARING, 2026, 25), new Date("2026-12-05T12:00:00+01:00")),
    ).toBeNull();
  });

  it("is null once the edition is ARCHIVED, even on a calendar day", () => {
    expect(
      getTodayDayNumber(edition(EditionStatus.ARCHIVED, 2026, 25), new Date("2026-12-05T12:00:00+01:00")),
    ).toBeNull();
  });
});

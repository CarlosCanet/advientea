import { describe, expect, it } from "vitest";

import {
  EDITION_YEAR_MAX,
  EDITION_YEAR_MIN,
  editionFormSchema,
  enrolGuestSchema,
  enrolUserSchema,
  placeParticipantSchema,
  swapParticipantsSchema,
  toEditionYear,
  unenrolParticipantSchema,
} from "@/lib/schemas/edition";

describe("editionFormSchema", () => {
  const valid = (year: number) => editionFormSchema.safeParse({ name: "Advienté", year }).success;

  it("accepts the years from 2024 to 2100, both included", () => {
    expect(EDITION_YEAR_MIN).toBe(2024);
    expect(valid(EDITION_YEAR_MIN)).toBe(true);
    expect(valid(EDITION_YEAR_MAX)).toBe(true);
  });

  it("refuses a year outside the range or with decimals", () => {
    expect(valid(EDITION_YEAR_MIN - 1)).toBe(false);
    expect(valid(EDITION_YEAR_MAX + 1)).toBe(false);
    expect(valid(2026.5)).toBe(false);
  });
});

describe("toEditionYear", () => {
  it("reads a year of four digits within the range", () => {
    expect(toEditionYear("2026")).toBe(2026);
    expect(toEditionYear(String(EDITION_YEAR_MIN))).toBe(EDITION_YEAR_MIN);
    expect(toEditionYear(String(EDITION_YEAR_MAX))).toBe(EDITION_YEAR_MAX);
  });

  it.each(["", "abc", "2026.5", "2026.0", "0x7EA", "2e3", "02026", " 2026", "-2026", "99999999999", "2023", "2101"])(
    "refuses %j",
    (segment) => {
      expect(toEditionYear(segment)).toBeNull();
    },
  );
});

describe("enrolUserSchema", () => {
  it("accepts an edition year and a user id", () => {
    expect(enrolUserSchema.safeParse({ userId: "user-id", year: 2026 }).success).toBe(true);
  });

  it("refuses an empty user id, one that is not text, or a year with decimals", () => {
    expect(enrolUserSchema.safeParse({ userId: "", year: 2026 }).success).toBe(false);
    expect(enrolUserSchema.safeParse({ userId: 7, year: 2026 }).success).toBe(false);
    expect(enrolUserSchema.safeParse({ userId: "user-id", year: 2026.5 }).success).toBe(false);
  });

  it("refuses a year outside the range of the editions", () => {
    expect(enrolUserSchema.safeParse({ userId: "user-id", year: EDITION_YEAR_MIN - 1 }).success).toBe(false);
    expect(enrolUserSchema.safeParse({ userId: "user-id", year: EDITION_YEAR_MAX + 1 }).success).toBe(false);
  });
});

describe("enrolGuestSchema", () => {
  it("returns the name without the spaces around it", () => {
    expect(enrolGuestSchema.parse({ name: "  Prima Lejana  ", year: 2026 })).toEqual({
      name: "Prima Lejana",
      year: 2026,
    });
  });

  it("refuses a name that is empty once trimmed", () => {
    expect(enrolGuestSchema.safeParse({ name: "   ", year: 2026 }).success).toBe(false);
  });

  it("accepts 60 characters and refuses 61", () => {
    expect(enrolGuestSchema.safeParse({ name: "a".repeat(60), year: 2026 }).success).toBe(true);
    expect(enrolGuestSchema.safeParse({ name: "a".repeat(61), year: 2026 }).success).toBe(false);
  });

  it("refuses a year with decimals", () => {
    expect(enrolGuestSchema.safeParse({ name: "Prima Lejana", year: 2026.5 }).success).toBe(false);
  });

  it("refuses a year outside the range of the editions", () => {
    expect(enrolGuestSchema.safeParse({ name: "Prima Lejana", year: EDITION_YEAR_MIN - 1 }).success).toBe(false);
    expect(enrolGuestSchema.safeParse({ name: "Prima Lejana", year: EDITION_YEAR_MAX + 1 }).success).toBe(false);
  });
});

describe("placeParticipantSchema", () => {
  const valid = (input: unknown) => placeParticipantSchema.safeParse(input).success;

  it.each([1, 2, 25, 26, 400])("accepts day %i: the only bound is at the bottom", (dayNumber) => {
    expect(placeParticipantSchema.parse({ dayNumber, participationId: "participation-id" })).toEqual({
      dayNumber,
      participationId: "participation-id",
    });
  });

  it("accepts null as the day, which means no day, and keeps it null", () => {
    expect(placeParticipantSchema.parse({ dayNumber: null, participationId: "participation-id" })).toEqual({
      dayNumber: null,
      participationId: "participation-id",
    });
  });

  it.each([0, -1, 2.5, Number.NaN, "3", "", undefined])("refuses %j as the day", (dayNumber) => {
    expect(valid({ dayNumber, participationId: "participation-id" })).toBe(false);
  });

  it("refuses an object without a day: no day has to be said with null", () => {
    expect(valid({ participationId: "participation-id" })).toBe(false);
  });

  it.each(["", 7, null, undefined])("refuses %j as the participation", (participationId) => {
    expect(valid({ dayNumber: 3, participationId })).toBe(false);
    expect(valid({ dayNumber: null, participationId })).toBe(false);
  });
});

describe("swapParticipantsSchema", () => {
  const valid = (input: unknown) => swapParticipantsSchema.safeParse(input).success;

  it("accepts two different participations", () => {
    expect(
      swapParticipantsSchema.parse({ firstParticipationId: "first-id", secondParticipationId: "second-id" }),
    ).toEqual({ firstParticipationId: "first-id", secondParticipationId: "second-id" });
  });

  it("refuses the same participation twice", () => {
    expect(valid({ firstParticipationId: "same-id", secondParticipationId: "same-id" })).toBe(false);
  });

  it.each(["", 7, null, undefined])("refuses %j as either participation", (participationId) => {
    expect(valid({ firstParticipationId: participationId, secondParticipationId: "second-id" })).toBe(false);
    expect(valid({ firstParticipationId: "first-id", secondParticipationId: participationId })).toBe(false);
  });

  it("refuses an object with one participation only", () => {
    expect(valid({ firstParticipationId: "first-id" })).toBe(false);
    expect(valid({ secondParticipationId: "second-id" })).toBe(false);
  });
});

describe("unenrolParticipantSchema", () => {
  const valid = (input: unknown) => unenrolParticipantSchema.safeParse(input).success;

  it.each([true, false])("accepts %j as the answer about the tea and keeps it as it came", (deleteTea) => {
    expect(unenrolParticipantSchema.parse({ deleteTea, participationId: "participation-id" })).toEqual({
      deleteTea,
      participationId: "participation-id",
    });
  });

  it("refuses an object without the answer about the tea: keeping it has to be said with false", () => {
    expect(valid({ participationId: "participation-id" })).toBe(false);
  });

  it.each(["true", "false", "", 1, 0, null, undefined])("refuses %j as the answer about the tea", (deleteTea) => {
    expect(valid({ deleteTea, participationId: "participation-id" })).toBe(false);
  });

  it.each(["", 7, null, undefined])("refuses %j as the participation", (participationId) => {
    expect(valid({ deleteTea: true, participationId })).toBe(false);
    expect(valid({ deleteTea: false, participationId })).toBe(false);
  });

  it("refuses an object without a participation", () => {
    expect(valid({ deleteTea: false })).toBe(false);
  });
});

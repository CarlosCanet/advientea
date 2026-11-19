import { describe, expect, it } from "vitest";

import {
  EDITION_YEAR_MAX,
  EDITION_YEAR_MIN,
  editionFormSchema,
  enrolGuestSchema,
  enrolUserSchema,
  toEditionYear,
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

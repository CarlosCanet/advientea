import { describe, expect, it } from "vitest";

import { EDITION_YEAR_MAX, EDITION_YEAR_MIN, editionFormSchema } from "@/lib/schemas/edition";

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

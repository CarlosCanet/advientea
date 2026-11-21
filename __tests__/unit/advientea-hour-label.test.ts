import { describe, expect, it } from "vitest";

import { HOURS, toHourLabel } from "@/lib/advientea-rules";

describe("toHourLabel", () => {
  it.each([
    [7, "07:00"],
    [13, "13:00"],
    [20, "20:00"],
    [0, "00:00"],
  ])("formats %i as %s", (hour, label) => {
    expect(toHourLabel(hour)).toBe(label);
  });
});

describe("HOURS", () => {
  it("holds the reveal hours of the day", () => {
    expect(HOURS).toMatchObject({ NAME: 20, PART1: 7, PART2: 13, PART3: 18, TEA: 20 });
  });
});

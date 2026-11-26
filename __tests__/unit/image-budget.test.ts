import { describe, expect, it } from "vitest";

import {
  getNewImagesBytes,
  isImageTooLarge,
  isOverNewImagesBudget,
  MAX_IMAGE_BYTES,
  MAX_NEW_IMAGES_BYTES,
  toMegabytesLabel,
} from "@/lib/image-budget";

const MIB = 1024 * 1024;

describe("image budget constants", () => {
  it("allows 2 MiB per image", () => {
    expect(MAX_IMAGE_BYTES).toBe(2_097_152);
  });

  it("allows 2.5 MiB for all the new images of one save", () => {
    expect(MAX_NEW_IMAGES_BYTES).toBe(2_621_440);
  });
});

describe("getNewImagesBytes", () => {
  it("returns 0 for an empty list", () => {
    expect(getNewImagesBytes([])).toBe(0);
  });

  it("sums the file sizes of the new images", () => {
    const images = [
      { file: { size: 100 }, isNew: true },
      { file: { size: 250 }, isNew: true },
      { file: { size: 1 }, isNew: true },
    ];

    expect(getNewImagesBytes(images)).toBe(351);
  });

  it("counts an already saved image as 0 even when it carries a file", () => {
    expect(getNewImagesBytes([{ file: { size: 5000 }, isNew: false }])).toBe(0);
  });

  it("counts a new image with a null file as 0", () => {
    expect(getNewImagesBytes([{ file: null, isNew: true }])).toBe(0);
  });

  it("counts a new image without a file property as 0", () => {
    expect(getNewImagesBytes([{ isNew: true }])).toBe(0);
  });

  it("adds only the new images that carry a file in a mixed list", () => {
    const images = [
      { file: { size: MIB }, isNew: true },
      { file: { size: 3 * MIB }, isNew: false },
      { file: null, isNew: true },
      { isNew: false },
      { isNew: true },
      { file: { size: 512 }, isNew: true },
    ];

    expect(getNewImagesBytes(images)).toBe(MIB + 512);
  });

  it("accepts a readonly array", () => {
    const images: ReadonlyArray<{ file?: null | { size: number }; isNew: boolean }> = Object.freeze([
      { file: { size: 10 }, isNew: true },
    ]);

    expect(getNewImagesBytes(images)).toBe(10);
  });
});

describe("isImageTooLarge", () => {
  it.each([
    [0, false],
    [MAX_IMAGE_BYTES - 1, false],
    [MAX_IMAGE_BYTES, false],
    [MAX_IMAGE_BYTES + 1, true],
    [3 * MIB, true],
  ])("%i bytes → too large: %s", (bytes, expected) => {
    expect(isImageTooLarge(bytes)).toBe(expected);
  });

  it("allows exactly 2 MiB", () => {
    expect(isImageTooLarge(2 * MIB)).toBe(false);
  });
});

describe("isOverNewImagesBudget", () => {
  it.each([
    [0, false],
    [MAX_NEW_IMAGES_BYTES - 1, false],
    [MAX_NEW_IMAGES_BYTES, false],
    [MAX_NEW_IMAGES_BYTES + 1, true],
    [5 * MIB, true],
  ])("%i bytes → over budget: %s", (bytes, expected) => {
    expect(isOverNewImagesBudget(bytes)).toBe(expected);
  });

  it("allows exactly 2.5 MiB", () => {
    expect(isOverNewImagesBudget(2.5 * MIB)).toBe(false);
  });

  it("allows a total over the per-image limit while within the budget", () => {
    expect(isOverNewImagesBudget(MAX_IMAGE_BYTES + 1)).toBe(false);
  });
});

describe("toMegabytesLabel", () => {
  it.each([
    [0, "0"],
    [1, "0,1"],
    [Math.round(1.2 * MIB), "1,2"],
    [2.5 * MIB, "2,5"],
    [2.5 * MIB + 1, "2,6"],
    [3 * MIB, "3"],
    [Math.round(10.05 * MIB), "10,1"],
  ])("labels %i bytes as %s", (bytes, label) => {
    expect(toMegabytesLabel(bytes)).toBe(label);
  });

  it.each([
    [MIB - 1, "1"],
    [MIB, "1"],
    [MIB + 1, "1,1"],
    [MAX_IMAGE_BYTES, "2"],
    [MAX_IMAGE_BYTES + 1, "2,1"],
  ])("rounds %i bytes up to %s", (bytes, label) => {
    expect(toMegabytesLabel(bytes)).toBe(label);
  });

  it("never labels a total just over the budget as the budget itself", () => {
    expect(toMegabytesLabel(MAX_NEW_IMAGES_BYTES + 1)).not.toBe(toMegabytesLabel(MAX_NEW_IMAGES_BYTES));
  });
});

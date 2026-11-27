import { describe, expect, it } from "vitest";

import { toNormalizedPassword } from "@/lib/password";

// "é" written as one code point (NFC) and as "e" plus a combining acute accent (NFD).
const E_NFC = "é";
const E_NFD = "é";

describe("toNormalizedPassword", () => {
  it("removes leading and trailing spaces", () => {
    expect(toNormalizedPassword("  Té2026!x  ")).toBe("Té2026!x");
  });

  it("keeps inner whitespace", () => {
    expect(toNormalizedPassword("a b")).toBe("a b");
    expect(toNormalizedPassword("  a \t b  ")).toBe("a \t b");
  });

  it("turns an NFD string into its NFC form", () => {
    const result = toNormalizedPassword(`T${E_NFD}`);

    expect(result).toBe(`T${E_NFC}`);
    expect(result).toHaveLength(2);
  });

  it("gives the same value for a password typed in NFD with spaces and in NFC without them", () => {
    expect(toNormalizedPassword(` T${E_NFD}tera2026! `)).toBe(toNormalizedPassword(`T${E_NFC}tera2026!`));
  });

  it("turns a string of whitespace only into an empty string", () => {
    expect(toNormalizedPassword("\t\n")).toBe("");
    expect(toNormalizedPassword("   ")).toBe("");
    expect(toNormalizedPassword("")).toBe("");
  });

  it("trims every character String.prototype.trim removes", () => {
    const padding = " 　﻿\r\n\t ";

    expect(toNormalizedPassword(`${padding}Abc1!xyz${padding}`)).toBe("Abc1!xyz");
  });

  it("keeps the case and the special characters as they are", () => {
    expect(toNormalizedPassword("AbC!@#$%^&*()_+1")).toBe("AbC!@#$%^&*()_+1");
  });

  it("leaves an already normalised value as it is", () => {
    const once = toNormalizedPassword(`  T${E_NFD}2026!x `);

    expect(toNormalizedPassword(once)).toBe(once);
  });
});

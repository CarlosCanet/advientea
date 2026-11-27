import type { z } from "zod";

import { describe, expect, it } from "vitest";

import { resetPasswordFormSchema, signupFormSchema, updateProfileFormSchema } from "@/lib/schemas/auth";

const MIN_LENGTH_ERROR = "La contraseña debe ser de al menos 8 caracteres.";
const MISMATCH_ERROR = "Las contraseñas no coinciden.";
const CURRENT_PASSWORD_ERROR = "Introduce tu contraseña actual para cambiarla.";

const E_NFC = "é";
const E_NFD = "é";
// The same password, typed in NFC without padding and in NFD with a trailing space.
const PASSWORD_NFC = `T${E_NFC}tera2026!`;
const PASSWORD_NFD_PADDED = `T${E_NFD}tera2026! `;
// 7 characters in NFC, 8 in NFD: too short once normalised.
const SHORT_NFC = `Ab1!xy${E_NFC}`;
const SHORT_NFD = `Ab1!xy${E_NFD}`;
// 128 characters in NFC, 253 in NFD: within the limit once normalised.
const LONG_NFC = "a1!" + E_NFC.repeat(125);
const LONG_NFD = "a1!" + E_NFD.repeat(125);

function messagesAt(result: z.ZodSafeParseResult<unknown>, field: string): Array<string> {
  if (result.success) {
    return [];
  }
  return result.error.issues.filter((issue) => issue.path.join(".") === field).map((issue) => issue.message);
}

function toResetInput(overrides: Record<string, unknown> = {}) {
  return {
    newPassword: PASSWORD_NFC,
    newPasswordConfirmation: PASSWORD_NFC,
    token: "reset-token-123",
    ...overrides,
  };
}

function toSignupInput(overrides: Record<string, unknown> = {}) {
  return {
    email: "ana@example.com",
    password: PASSWORD_NFC,
    passwordConfirmation: PASSWORD_NFC,
    username: "Ana",
    ...overrides,
  };
}

function toUpdateProfileInput(overrides: Record<string, unknown> = {}) {
  return {
    currentPassword: "Actual123!",
    newPassword: PASSWORD_NFC,
    newPasswordConfirmation: PASSWORD_NFC,
    username: "Ana",
    ...overrides,
  };
}

describe("the sanity of the fixtures", () => {
  it("uses strings whose NFC and NFD forms differ in length", () => {
    expect(SHORT_NFC).toHaveLength(7);
    expect(SHORT_NFD).toHaveLength(8);
    expect(LONG_NFC).toHaveLength(128);
    expect(LONG_NFD.length).toBeGreaterThan(128);
    expect(PASSWORD_NFD_PADDED.trim().normalize("NFC")).toBe(PASSWORD_NFC);
  });
});

describe("resetPasswordFormSchema password normalisation", () => {
  it("checks the length after trimming: ' Ab1!xyz ' is too short", () => {
    const result = resetPasswordFormSchema.safeParse(
      toResetInput({ newPassword: " Ab1!xyz ", newPasswordConfirmation: " Ab1!xyz " }),
    );

    expect(result.success).toBe(false);
    expect(messagesAt(result, "newPassword")).toContain(MIN_LENGTH_ERROR);
  });

  it("checks the minimum length on the NFC form", () => {
    const result = resetPasswordFormSchema.safeParse(
      toResetInput({ newPassword: SHORT_NFD, newPasswordConfirmation: SHORT_NFD }),
    );

    expect(result.success).toBe(false);
    expect(messagesAt(result, "newPassword")).toContain(MIN_LENGTH_ERROR);
  });

  it("checks the maximum length on the NFC form", () => {
    const result = resetPasswordFormSchema.safeParse(
      toResetInput({ newPassword: LONG_NFD, newPasswordConfirmation: LONG_NFD }),
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.newPassword).toBe(LONG_NFC);
    }
  });

  it("matches a padded NFD password with its unpadded NFC confirmation", () => {
    const result = resetPasswordFormSchema.safeParse(
      toResetInput({ newPassword: PASSWORD_NFD_PADDED, newPasswordConfirmation: PASSWORD_NFC }),
    );

    expect(result.success).toBe(true);
    expect(messagesAt(result, "newPasswordConfirmation")).not.toContain(MISMATCH_ERROR);
  });

  it("matches an NFC password with its padded NFD confirmation", () => {
    const result = resetPasswordFormSchema.safeParse(
      toResetInput({ newPassword: PASSWORD_NFC, newPasswordConfirmation: PASSWORD_NFD_PADDED }),
    );

    expect(result.success).toBe(true);
  });

  it("returns the new password and its confirmation normalised", () => {
    const result = resetPasswordFormSchema.safeParse(
      toResetInput({ newPassword: PASSWORD_NFD_PADDED, newPasswordConfirmation: ` ${PASSWORD_NFD_PADDED}` }),
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.newPassword).toBe(PASSWORD_NFC);
      expect(result.data.newPasswordConfirmation).toBe(PASSWORD_NFC);
    }
  });

  it("keeps the inner whitespace of the password", () => {
    const withSpace = "Abc 123!x";
    const result = resetPasswordFormSchema.safeParse(
      toResetInput({ newPassword: ` ${withSpace} `, newPasswordConfirmation: withSpace }),
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.newPassword).toBe(withSpace);
    }
  });

  it("still refuses a confirmation that differs once normalised", () => {
    const result = resetPasswordFormSchema.safeParse(
      toResetInput({ newPassword: PASSWORD_NFD_PADDED, newPasswordConfirmation: "Tetera2026!" }),
    );

    expect(result.success).toBe(false);
    expect(messagesAt(result, "newPasswordConfirmation")).toContain(MISMATCH_ERROR);
  });
});

describe("signupFormSchema password normalisation", () => {
  it("checks the length after trimming: ' Ab1!xyz ' is too short", () => {
    const result = signupFormSchema.safeParse(
      toSignupInput({ password: " Ab1!xyz ", passwordConfirmation: " Ab1!xyz " }),
    );

    expect(result.success).toBe(false);
    expect(messagesAt(result, "password")).toContain(MIN_LENGTH_ERROR);
  });

  it("checks the minimum length on the NFC form", () => {
    const result = signupFormSchema.safeParse(toSignupInput({ password: SHORT_NFD, passwordConfirmation: SHORT_NFD }));

    expect(result.success).toBe(false);
    expect(messagesAt(result, "password")).toContain(MIN_LENGTH_ERROR);
  });

  it("matches a padded NFD password with its unpadded NFC confirmation", () => {
    const result = signupFormSchema.safeParse(
      toSignupInput({ password: PASSWORD_NFD_PADDED, passwordConfirmation: PASSWORD_NFC }),
    );

    expect(result.success).toBe(true);
    expect(messagesAt(result, "passwordConfirmation")).not.toContain(MISMATCH_ERROR);
  });

  it("returns the password normalised", () => {
    const result = signupFormSchema.safeParse(
      toSignupInput({ password: PASSWORD_NFD_PADDED, passwordConfirmation: PASSWORD_NFD_PADDED }),
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.password).toBe(PASSWORD_NFC);
    }
  });

  it("still refuses a confirmation that differs once normalised", () => {
    const result = signupFormSchema.safeParse(
      toSignupInput({ password: PASSWORD_NFD_PADDED, passwordConfirmation: "Otra2026!x" }),
    );

    expect(result.success).toBe(false);
    expect(messagesAt(result, "passwordConfirmation")).toContain(MISMATCH_ERROR);
  });
});

describe("updateProfileFormSchema password normalisation", () => {
  it("checks the length of the new password after trimming: ' Ab1!xyz ' is too short", () => {
    const result = updateProfileFormSchema.safeParse(
      toUpdateProfileInput({ newPassword: " Ab1!xyz ", newPasswordConfirmation: " Ab1!xyz " }),
    );

    expect(result.success).toBe(false);
    expect(messagesAt(result, "newPassword")).toContain(MIN_LENGTH_ERROR);
  });

  it("checks the minimum length of the new password on the NFC form", () => {
    const result = updateProfileFormSchema.safeParse(
      toUpdateProfileInput({ newPassword: SHORT_NFD, newPasswordConfirmation: SHORT_NFD }),
    );

    expect(result.success).toBe(false);
    expect(messagesAt(result, "newPassword")).toContain(MIN_LENGTH_ERROR);
  });

  it("matches a padded NFD new password with its unpadded NFC confirmation", () => {
    const result = updateProfileFormSchema.safeParse(
      toUpdateProfileInput({ newPassword: PASSWORD_NFD_PADDED, newPasswordConfirmation: PASSWORD_NFC }),
    );

    expect(result.success).toBe(true);
    expect(messagesAt(result, "newPasswordConfirmation")).not.toContain(MISMATCH_ERROR);
  });

  it("returns the new password normalised", () => {
    const result = updateProfileFormSchema.safeParse(
      toUpdateProfileInput({ newPassword: PASSWORD_NFD_PADDED, newPasswordConfirmation: PASSWORD_NFC }),
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.newPassword).toBe(PASSWORD_NFC);
    }
  });

  it("returns the current password trimmed and in NFC", () => {
    const result = updateProfileFormSchema.safeParse(
      toUpdateProfileInput({ currentPassword: `  Act${E_NFD}al123!  ` }),
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.currentPassword).toBe(`Act${E_NFC}al123!`);
    }
  });

  it.each([
    ["spaces and an empty confirmation", "   ", ""],
    ["spaces and a confirmation of spaces", "   ", "  "],
    ["tabs and newlines and a confirmation of spaces", "\t\n", " "],
  ])("keeps the current password when the new one is whitespace only: %s", (_label, newPassword, confirmation) => {
    const result = updateProfileFormSchema.safeParse(
      toUpdateProfileInput({ currentPassword: "", newPassword, newPasswordConfirmation: confirmation }),
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.newPassword).toBeUndefined();
      expect(result.data.newPasswordConfirmation).toBeUndefined();
    }
    expect(messagesAt(result, "newPasswordConfirmation")).toEqual([]);
    expect(messagesAt(result, "currentPassword")).toEqual([]);
  });

  it("keeps the current password with a whitespace-only new one and no current password at all", () => {
    const result = updateProfileFormSchema.safeParse(
      toUpdateProfileInput({ currentPassword: undefined, newPassword: "   ", newPasswordConfirmation: "   " }),
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.newPassword).toBeUndefined();
      expect(result.data.newPasswordConfirmation).toBeUndefined();
    }
  });

  it("asks for the current password when it is only spaces and the password changes", () => {
    const result = updateProfileFormSchema.safeParse(toUpdateProfileInput({ currentPassword: "    " }));

    expect(result.success).toBe(false);
    expect(messagesAt(result, "currentPassword")).toContain(CURRENT_PASSWORD_ERROR);
  });

  it("still refuses a confirmation that differs once normalised", () => {
    const result = updateProfileFormSchema.safeParse(
      toUpdateProfileInput({ newPassword: PASSWORD_NFD_PADDED, newPasswordConfirmation: "Otra2026!x" }),
    );

    expect(result.success).toBe(false);
    expect(messagesAt(result, "newPasswordConfirmation")).toContain(MISMATCH_ERROR);
  });
});

import type { z } from "zod";

import { describe, expect, expectTypeOf, it } from "vitest";

import {
  requestPasswordResetFormSchema,
  resetPasswordFormSchema,
  signupFormSchema,
  updateProfileFormSchema,
} from "@/lib/schemas/auth";
import {
  initialRequestPasswordResetActionResponse,
  initialResetPasswordActionResponse,
  type RequestPasswordResetActionResponse,
  type RequestPasswordResetFormData,
  type ResetPasswordActionResponse,
  type ResetPasswordFormData,
} from "@/lib/types";

const EMAIL_ERROR = "Introduce un email correcto.";
const TOKEN_ERROR = "El enlace no es válido. Pide uno nuevo.";
const MIN_LENGTH_ERROR = "La contraseña debe ser de al menos 8 caracteres.";
const LETTER_ERROR = "La contraseña debe contener al menos una letra.";
const NUMBER_ERROR = "La contraseña debe contener al menos un número.";
const SPECIAL_ERROR = "Debe contener al menos un caracter especial.";
const MAX_LENGTH_ERROR = "La contraseña no puede tener más de 128 caracteres.";
const MISMATCH_ERROR = "Las contraseñas no coinciden.";

const VALID_PASSWORD = "Abcdef1!";
const PASSWORD_128 = "a1!" + "x".repeat(125);
const PASSWORD_129 = "a1!" + "x".repeat(126);

function messagesAt(result: z.ZodSafeParseResult<unknown>, field: string): Array<string> {
  if (result.success) {
    return [];
  }
  return result.error.issues.filter((issue) => issue.path.join(".") === field).map((issue) => issue.message);
}

function toResetInput(overrides: Record<string, unknown> = {}) {
  return {
    newPassword: VALID_PASSWORD,
    newPasswordConfirmation: VALID_PASSWORD,
    token: "reset-token-123",
    ...overrides,
  };
}

function toSignupInput(overrides: Record<string, unknown> = {}) {
  return {
    email: "ana@example.com",
    password: VALID_PASSWORD,
    passwordConfirmation: VALID_PASSWORD,
    username: "Ana",
    ...overrides,
  };
}

function toUpdateProfileInput(overrides: Record<string, unknown> = {}) {
  return {
    currentPassword: "OldPass1!",
    newPassword: VALID_PASSWORD,
    newPasswordConfirmation: VALID_PASSWORD,
    username: "Ana",
    ...overrides,
  };
}

describe("requestPasswordResetFormSchema", () => {
  it("accepts a valid email and returns it trimmed, case unchanged", () => {
    const result = requestPasswordResetFormSchema.safeParse({ email: "  Ana.Garcia@Example.com  " });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ email: "Ana.Garcia@Example.com" });
    }
  });

  it.each(["", "   ", "not-an-email", "ana@", "@example.com", "ana example.com"])(
    "refuses %j with the email message",
    (email) => {
      const result = requestPasswordResetFormSchema.safeParse({ email });

      expect(result.success).toBe(false);
      expect(messagesAt(result, "email")).toContain(EMAIL_ERROR);
    },
  );

  it("refuses a missing email on the email field", () => {
    const result = requestPasswordResetFormSchema.safeParse({});

    expect(result.success).toBe(false);
    expect(messagesAt(result, "email").length).toBeGreaterThan(0);
  });

  it("strips unknown keys", () => {
    const result = requestPasswordResetFormSchema.safeParse({ email: "ana@example.com", role: "ADMIN" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ email: "ana@example.com" });
      expect(result.data).not.toHaveProperty("role");
    }
  });
});

describe("resetPasswordFormSchema", () => {
  it("accepts a valid input and returns the three fields", () => {
    const result = resetPasswordFormSchema.safeParse(toResetInput());

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        newPassword: VALID_PASSWORD,
        newPasswordConfirmation: VALID_PASSWORD,
        token: "reset-token-123",
      });
    }
  });

  it("trims the token and both passwords", () => {
    const result = resetPasswordFormSchema.safeParse(
      toResetInput({
        newPassword: `  ${VALID_PASSWORD}  `,
        newPasswordConfirmation: ` ${VALID_PASSWORD}`,
        token: "  reset-token-123 ",
      }),
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        newPassword: VALID_PASSWORD,
        newPasswordConfirmation: VALID_PASSWORD,
        token: "reset-token-123",
      });
    }
  });

  it("strips unknown keys", () => {
    const result = resetPasswordFormSchema.safeParse(toResetInput({ email: "ana@example.com" }));

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("email");
    }
  });

  it.each(["", "   "])("refuses the token %j with the token message", (token) => {
    const result = resetPasswordFormSchema.safeParse(toResetInput({ token }));

    expect(result.success).toBe(false);
    expect(messagesAt(result, "token")).toContain(TOKEN_ERROR);
    expect(messagesAt(result, "newPassword")).toEqual([]);
    expect(messagesAt(result, "newPasswordConfirmation")).toEqual([]);
  });

  it("refuses a missing token on the token field", () => {
    const result = resetPasswordFormSchema.safeParse({
      newPassword: VALID_PASSWORD,
      newPasswordConfirmation: VALID_PASSWORD,
    });

    expect(result.success).toBe(false);
    expect(messagesAt(result, "token").length).toBeGreaterThan(0);
  });

  it.each([
    ["shorter than 8 characters", "Ab1!", MIN_LENGTH_ERROR],
    ["under 8 characters once trimmed", "   Ab1!x   ", MIN_LENGTH_ERROR],
    ["without a letter", "12345678!", LETTER_ERROR],
    ["without a number", "Abcdefgh!", NUMBER_ERROR],
    ["without a special character", "Abcdefg1", SPECIAL_ERROR],
    ["longer than 128 characters", PASSWORD_129, MAX_LENGTH_ERROR],
  ])("refuses a new password %s with its message", (_label, password, message) => {
    const result = resetPasswordFormSchema.safeParse(
      toResetInput({ newPassword: password, newPasswordConfirmation: password }),
    );

    expect(result.success).toBe(false);
    expect(messagesAt(result, "newPassword")).toContain(message);
  });

  it("accepts a new password of exactly 128 characters", () => {
    expect(PASSWORD_128).toHaveLength(128);
    const result = resetPasswordFormSchema.safeParse(
      toResetInput({ newPassword: PASSWORD_128, newPasswordConfirmation: PASSWORD_128 }),
    );

    expect(result.success).toBe(true);
  });

  it("applies the 128 limit after trimming", () => {
    const padded = `  ${PASSWORD_128}  `;
    const result = resetPasswordFormSchema.safeParse(
      toResetInput({ newPassword: padded, newPasswordConfirmation: padded }),
    );

    expect(result.success).toBe(true);
  });

  it("refuses a password of 129 characters with the new message", () => {
    expect(PASSWORD_129).toHaveLength(129);
    const result = resetPasswordFormSchema.safeParse(
      toResetInput({ newPassword: PASSWORD_129, newPasswordConfirmation: PASSWORD_129 }),
    );

    expect(result.success).toBe(false);
    expect(messagesAt(result, "newPassword")).toEqual([MAX_LENGTH_ERROR]);
  });

  it("refuses a confirmation that differs, on newPasswordConfirmation", () => {
    const result = resetPasswordFormSchema.safeParse(toResetInput({ newPasswordConfirmation: "Abcdef1?" }));

    expect(result.success).toBe(false);
    expect(messagesAt(result, "newPasswordConfirmation")).toContain(MISMATCH_ERROR);
    expect(messagesAt(result, "newPassword")).toEqual([]);
  });
});

describe("the 128-character limit on the shared password rule", () => {
  it("applies to signupFormSchema.password", () => {
    const accepted = signupFormSchema.safeParse(
      toSignupInput({ password: PASSWORD_128, passwordConfirmation: PASSWORD_128 }),
    );
    const refused = signupFormSchema.safeParse(
      toSignupInput({ password: PASSWORD_129, passwordConfirmation: PASSWORD_129 }),
    );

    expect(accepted.success).toBe(true);
    expect(refused.success).toBe(false);
    expect(messagesAt(refused, "password")).toContain(MAX_LENGTH_ERROR);
  });

  it("applies to updateProfileFormSchema.newPassword", () => {
    const accepted = updateProfileFormSchema.safeParse(
      toUpdateProfileInput({ newPassword: PASSWORD_128, newPasswordConfirmation: PASSWORD_128 }),
    );
    const refused = updateProfileFormSchema.safeParse(
      toUpdateProfileInput({ newPassword: PASSWORD_129, newPasswordConfirmation: PASSWORD_129 }),
    );

    expect(accepted.success).toBe(true);
    expect(refused.success).toBe(false);
    expect(messagesAt(refused, "newPassword")).toContain(MAX_LENGTH_ERROR);
  });

  it("still lets the profile form keep the current password with an empty new one", () => {
    const result = updateProfileFormSchema.safeParse(
      toUpdateProfileInput({ currentPassword: undefined, newPassword: "", newPasswordConfirmation: "" }),
    );

    expect(result.success).toBe(true);
  });
});

describe("signupFormSchema email", () => {
  it("returns the email trimmed, case unchanged", () => {
    const result = signupFormSchema.safeParse(toSignupInput({ email: "  Ana@Example.com " }));

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("Ana@Example.com");
    }
  });

  it.each(["", "   ", "not-an-email"])("refuses %j with the email message", (email) => {
    const result = signupFormSchema.safeParse(toSignupInput({ email }));

    expect(result.success).toBe(false);
    expect(messagesAt(result, "email")).toContain(EMAIL_ERROR);
  });
});

describe("password reset response types", () => {
  it("start empty and unsuccessful", () => {
    expect(initialRequestPasswordResetActionResponse).toEqual({ message: "", success: false });
    expect(initialResetPasswordActionResponse).toEqual({ message: "", success: false });
  });

  it("match the declared shapes", () => {
    ({ message: "", success: false }) satisfies RequestPasswordResetActionResponse;
    ({ message: "", success: false }) satisfies ResetPasswordActionResponse;

    expectTypeOf(initialRequestPasswordResetActionResponse).toEqualTypeOf<RequestPasswordResetActionResponse>();
    expectTypeOf(initialResetPasswordActionResponse).toEqualTypeOf<ResetPasswordActionResponse>();

    expectTypeOf<RequestPasswordResetFormData>().toEqualTypeOf<{ email: string }>();
    expectTypeOf<RequestPasswordResetActionResponse["inputs"]>().toEqualTypeOf<
      RequestPasswordResetFormData | undefined
    >();
    expectTypeOf<RequestPasswordResetActionResponse["errors"]>().toEqualTypeOf<undefined | { email?: Array<string> }>();

    expectTypeOf<ResetPasswordFormData>().toEqualTypeOf<{
      newPassword: string;
      newPasswordConfirmation: string;
      token: string;
    }>();
    expectTypeOf<ResetPasswordActionResponse>().not.toHaveProperty("inputs");
    expectTypeOf<ResetPasswordActionResponse["errors"]>().toEqualTypeOf<
      | undefined
      | {
          newPassword?: Array<string>;
          newPasswordConfirmation?: Array<string>;
          token?: Array<string>;
        }
    >();
  });

  it("type the schema outputs as the form data", () => {
    expectTypeOf<z.output<typeof requestPasswordResetFormSchema>>().toEqualTypeOf<RequestPasswordResetFormData>();
    expectTypeOf<z.output<typeof resetPasswordFormSchema>>().toEqualTypeOf<ResetPasswordFormData>();
  });
});

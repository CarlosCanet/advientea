import { APIError } from "better-auth/api";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { inspect } from "node:util";
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from "vitest";
import { z } from "zod";

import {
  requestPasswordResetAction,
  resetPasswordAction,
  signin,
  signup,
  updateUserProfile,
} from "@/app/actions/authActions";
import { auth } from "@/lib/auth";
import { deleteAsset, uploadImage } from "@/lib/cloudinary";
import { editUser, requireSession } from "@/lib/dal";
import { RateLimitError, UnauthenticatedError } from "@/lib/errors";
import { resetPasswordFormSchema } from "@/lib/schemas/auth";
import { assertWithinRateLimit, getClientIP } from "@/lib/services/rate-limit-service";
import { createUser } from "@/lib/services/user-service";

vi.mock("@/lib/services/rate-limit-service", () => ({
  assertWithinRateLimit: vi.fn(),
  getClientIP: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      changePassword: vi.fn(),
      getSession: vi.fn().mockResolvedValue(null),
      requestPasswordReset: vi.fn(),
      resetPassword: vi.fn(),
      signInEmail: vi.fn(),
      signOut: vi.fn(),
      signUpEmail: vi.fn(),
    },
  },
}));
vi.mock("@/lib/services/user-service", () => ({ createUser: vi.fn() }));
vi.mock("@/lib/cloudinary", () => ({ deleteAsset: vi.fn(), uploadImage: vi.fn() }));
vi.mock("@/lib/dal", () => ({
  changeUserRole: vi.fn(),
  consumeRateLimit: vi.fn(),
  editUser: vi.fn(),
  requireRole: vi.fn(),
  requireSession: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("next/navigation", () => ({
  // Like Next.js: redirect never returns, it throws an error the framework recognises.
  redirect: vi.fn((url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { digest: `NEXT_REDIRECT;replace;${url};307;` });
  }),
}));
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ get: () => undefined, getAll: () => [], has: () => false }),
  headers: vi.fn().mockResolvedValue(new Headers()),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const TOO_MANY = "Demasiados intentos. Espera unos minutos y vuelve a intentarlo.";
const TOO_MANY_HOUR = "Demasiados intentos. Vuelve a intentarlo dentro de una hora.";
const WRONG_CREDENTIALS = "Usuario o contraseña incorrectos";
const SIGNIN_FAILED = "No se pudo iniciar sesión. Inténtalo de nuevo.";
const SIGNUP_FAILED = "No se pudo crear la cuenta. Inténtalo de nuevo.";
// What the rate limiter throws when it cannot decide: no secret, or the database is down.
const LIMITER_FAILURES: Array<[string, Error]> = [
  ["the secret is missing", new Error("BETTER_AUTH_SECRET is not set")],
  ["the database fails", new Error("Can't reach database server")],
];
const EMAIL = "ana@example.com";
const IP = "203.0.113.7";

function signinForm(email = EMAIL, password = "Contraseña1!") {
  const formData = new FormData();
  formData.append("email", email);
  formData.append("password", password);
  return formData;
}

function signupForm(fields: Partial<Record<"email" | "password" | "passwordConfirmation" | "username", string>> = {}) {
  const formData = new FormData();
  const values = {
    email: EMAIL,
    password: "Secreto123!",
    passwordConfirmation: "Secreto123!",
    username: "Ana",
    ...fields,
  };
  for (const [key, value] of Object.entries(values)) {
    formData.append(key, value);
  }
  return formData;
}

/** Everything handed to console.warn and console.error, rendered the way a log line would show it. */
function loggedText(...spies: Array<{ mock: { calls: unknown[][] } }>) {
  return spies
    .flatMap((spy) => spy.mock.calls.flat())
    .map((arg) => (typeof arg === "string" ? arg : inspect(arg, { depth: 10 })))
    .join("\n");
}

let warn: MockInstance<typeof console.warn>;
let error: MockInstance<typeof console.error>;

beforeEach(() => {
  vi.clearAllMocks();
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  error = vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(getClientIP).mockResolvedValue(IP);
  vi.mocked(assertWithinRateLimit).mockResolvedValue(undefined);
});

afterEach(() => {
  warn.mockRestore();
  error.mockRestore();
});

describe("signin", () => {
  it("checks the signin rate limit with the form's email and the client ip", async () => {
    vi.mocked(auth.api.signInEmail).mockResolvedValue({} as never);

    await signin(null, signinForm()).catch(() => undefined);

    expect(getClientIP).toHaveBeenCalled();
    expect(assertWithinRateLimit).toHaveBeenCalledOnce();
    expect(assertWithinRateLimit).toHaveBeenCalledWith("signin", { email: EMAIL, ip: IP });
  });

  it("checks the rate limit before asking better-auth to sign in", async () => {
    vi.mocked(auth.api.signInEmail).mockResolvedValue({} as never);

    await signin(null, signinForm()).catch(() => undefined);

    expect(auth.api.signInEmail).toHaveBeenCalledOnce();
    expect(vi.mocked(assertWithinRateLimit).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(auth.api.signInEmail).mock.invocationCallOrder[0],
    );
  });

  it("passes the ip as null when the request has none", async () => {
    vi.mocked(getClientIP).mockResolvedValue(null);
    vi.mocked(auth.api.signInEmail).mockResolvedValue({} as never);

    await signin(null, signinForm()).catch(() => undefined);

    expect(assertWithinRateLimit).toHaveBeenCalledWith("signin", { email: EMAIL, ip: null });
  });

  it("refuses a rate-limited attempt without signing in or redirecting", async () => {
    vi.mocked(assertWithinRateLimit).mockRejectedValue(new RateLimitError(TOO_MANY));

    const result = await signin(null, signinForm());

    expect(result).toEqual({ errors: { password: [TOO_MANY] }, message: TOO_MANY, success: false });
    expect(auth.api.signInEmail).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("answers with the message the rate limiter threw", async () => {
    const thrown = "Mensaje de prueba del limitador";
    vi.mocked(assertWithinRateLimit).mockRejectedValue(new RateLimitError(thrown));

    const result = await signin(null, signinForm());

    expect(result).toEqual({ errors: { password: [thrown] }, message: thrown, success: false });
  });

  it("keeps the email and the ip out of the logs when an attempt is rate-limited", async () => {
    vi.mocked(assertWithinRateLimit).mockRejectedValue(new RateLimitError(TOO_MANY));

    await signin(null, signinForm());

    const logged = loggedText(warn, error);
    expect(logged).not.toContain(EMAIL);
    expect(logged).not.toContain(IP);
  });

  describe.each(LIMITER_FAILURES)("when the rate limiter fails because %s", (_reason, failure) => {
    beforeEach(() => {
      vi.mocked(assertWithinRateLimit).mockRejectedValue(failure);
    });

    it("fails closed: never asks better-auth, never redirects, answers the generic message", async () => {
      const result = await signin(null, signinForm());

      expect(result).toEqual({ errors: { password: [SIGNIN_FAILED] }, message: SIGNIN_FAILED, success: false });
      expect(auth.api.signInEmail).not.toHaveBeenCalled();
      expect(redirect).not.toHaveBeenCalled();
    });

    it("logs the failure with console.error, without the email or the ip", async () => {
      await signin(null, signinForm());

      expect(error).toHaveBeenCalled();
      const logged = loggedText(warn, error);
      expect(logged).not.toContain(EMAIL);
      expect(logged).not.toContain(IP);
    });
  });

  it("answers wrong credentials as before", async () => {
    vi.mocked(auth.api.signInEmail).mockRejectedValue(
      new APIError("UNAUTHORIZED", { code: "INVALID_EMAIL_OR_PASSWORD", message: "Invalid email or password" }),
    );

    const result = await signin(null, signinForm());

    expect(result).toEqual({ errors: { password: [WRONG_CREDENTIALS] }, message: WRONG_CREDENTIALS, success: false });
    expect(redirect).not.toHaveBeenCalled();
  });

  it("keeps the email and the ip out of the logs on wrong credentials", async () => {
    vi.mocked(auth.api.signInEmail).mockRejectedValue(
      new APIError("UNAUTHORIZED", { code: "INVALID_EMAIL_OR_PASSWORD", message: "Invalid email or password" }),
    );

    await signin(null, signinForm());

    const logged = loggedText(warn, error);
    expect(logged).not.toContain(EMAIL);
    expect(logged).not.toContain(IP);
  });

  it("signs in with the form's email and password and redirects home", async () => {
    vi.mocked(auth.api.signInEmail).mockResolvedValue({} as never);

    await expect(signin(null, signinForm(EMAIL, "Contraseña1!"))).rejects.toThrow("NEXT_REDIRECT");

    expect(auth.api.signInEmail).toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.objectContaining({ email: EMAIL, password: "Contraseña1!" }) }),
    );
    expect(redirect).toHaveBeenCalledWith("/");
  });
});

describe("signup", () => {
  type CreatedUser = Awaited<ReturnType<typeof createUser>>;

  beforeEach(() => {
    vi.mocked(createUser).mockResolvedValue({ id: "new-user-id" } as CreatedUser);
  });

  it("answers an invalid form with the validation errors and consumes no rate limit", async () => {
    const result = await signup(null, signupForm({ password: "corta", passwordConfirmation: "Otra123!" }));

    expect(result.success).toBe(false);
    expect(result.message).toBe("Hay errores en el formulario");
    expect(result.errors?.properties).toBeDefined();
    expect(getClientIP).not.toHaveBeenCalled();
    expect(assertWithinRateLimit).not.toHaveBeenCalled();
    expect(createUser).not.toHaveBeenCalled();
  });

  it("checks the signup rate limit with the client ip only", async () => {
    await signup(null, signupForm()).catch(() => undefined);

    expect(assertWithinRateLimit).toHaveBeenCalledOnce();
    expect(assertWithinRateLimit).toHaveBeenCalledWith("signup", { ip: IP });
  });

  it("checks the rate limit before creating the account", async () => {
    await signup(null, signupForm()).catch(() => undefined);

    expect(createUser).toHaveBeenCalledOnce();
    expect(vi.mocked(assertWithinRateLimit).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(createUser).mock.invocationCallOrder[0],
    );
  });

  it("refuses a rate-limited attempt without creating the account or uploading anything", async () => {
    vi.mocked(assertWithinRateLimit).mockRejectedValue(new RateLimitError(TOO_MANY_HOUR));

    const result = await signup(null, signupForm());

    expect(result).toEqual({ errors: { errors: [TOO_MANY_HOUR] }, message: TOO_MANY_HOUR, success: false });
    expect(createUser).not.toHaveBeenCalled();
    expect(uploadImage).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("answers with the message the rate limiter threw", async () => {
    const thrown = "Mensaje de prueba del limitador";
    vi.mocked(assertWithinRateLimit).mockRejectedValue(new RateLimitError(thrown));

    const result = await signup(null, signupForm());

    expect(result).toEqual({ errors: { errors: [thrown] }, message: thrown, success: false });
  });

  it("keeps the email and the ip out of the logs when an attempt is rate-limited", async () => {
    vi.mocked(assertWithinRateLimit).mockRejectedValue(new RateLimitError(TOO_MANY_HOUR));

    await signup(null, signupForm());

    const logged = loggedText(warn, error);
    expect(logged).not.toContain(EMAIL);
    expect(logged).not.toContain(IP);
  });

  describe.each(LIMITER_FAILURES)("when the rate limiter fails because %s", (_reason, failure) => {
    beforeEach(() => {
      vi.mocked(assertWithinRateLimit).mockRejectedValue(failure);
    });

    it("fails closed: creates no account, uploads nothing, never redirects, answers the generic message", async () => {
      const result = await signup(null, signupForm());

      expect(result).toEqual({ errors: { errors: [SIGNUP_FAILED] }, message: SIGNUP_FAILED, success: false });
      expect(createUser).not.toHaveBeenCalled();
      expect(uploadImage).not.toHaveBeenCalled();
      expect(redirect).not.toHaveBeenCalled();
    });

    it("keeps the email and the ip out of the logs", async () => {
      await signup(null, signupForm());

      const logged = loggedText(warn, error);
      expect(logged).not.toContain(EMAIL);
      expect(logged).not.toContain(IP);
    });
  });

  it("still answers a duplicate email as before", async () => {
    vi.mocked(createUser).mockRejectedValue(
      new APIError("UNPROCESSABLE_ENTITY", {
        code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL",
        message: "User already exists. Use another email.",
      }),
    );

    const result = await signup(null, signupForm());

    expect(result).toEqual({
      errors: { errors: ["Ya existe una cuenta con ese email"] },
      message: "Ya existe una cuenta con ese email",
      success: false,
    });
  });

  it("creates the account with the form's data and redirects home", async () => {
    await expect(signup(null, signupForm())).rejects.toThrow("NEXT_REDIRECT");

    expect(createUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: EMAIL, password: "Secreto123!", username: "Ana" }),
    );
    expect(redirect).toHaveBeenCalledWith("/");
  });
});

describe("requestPasswordResetAction", () => {
  const INVALID_EMAIL = "Introduce un email correcto.";
  const FORM_ERRORS = "Hay errores en el formulario";
  const RESET_FAILED = "No se pudo enviar el enlace. Inténtalo de nuevo.";
  const RESET_SENT =
    "Si existe una cuenta con ese email, te hemos enviado un enlace para elegir una contraseña nueva. Revisa también la carpeta de spam.";
  const SUCCESS = { message: RESET_SENT, success: true };
  const UNKNOWN_EMAIL = "nadie@example.com";
  const MALFORMED_EMAIL = "ana.sin.arroba.example.com";
  const PADDED_EMAIL = `  ${EMAIL}  `;
  // better-auth resolves for an unknown email too; whatever it answers, the action must not tell them apart.
  const AUTH_ANSWERS: Array<[string, unknown]> = [
    ["an account exists", { status: true }],
    [
      "no account exists",
      { message: "If this email exists in our system, check your email for the reset link", status: true },
    ],
  ];

  let log: MockInstance<typeof console.log>;
  let info: MockInstance<typeof console.info>;
  let debug: MockInstance<typeof console.debug>;

  function resetForm(email: string = EMAIL) {
    const formData = new FormData();
    formData.append("email", email);
    return formData;
  }

  /** Neither the address as typed nor trimmed shows up in anything written to the console. */
  function expectEmailNotLogged(email: string) {
    const logged = loggedText(warn, error, log, info, debug);
    expect(logged).not.toContain(email);
    expect(logged).not.toContain(email.trim());
  }

  function expectNoNavigation() {
    expect(redirect).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  }

  beforeEach(() => {
    log = vi.spyOn(console, "log").mockImplementation(() => {});
    info = vi.spyOn(console, "info").mockImplementation(() => {});
    debug = vi.spyOn(console, "debug").mockImplementation(() => {});
    vi.mocked(auth.api.requestPasswordReset).mockResolvedValue({ status: true } as never);
  });

  afterEach(() => {
    log.mockRestore();
    info.mockRestore();
    debug.mockRestore();
  });

  describe.each([
    ["a malformed email", MALFORMED_EMAIL],
    ["a blank email", ""],
    ["an email of spaces only", "   "],
  ])("with %s", (_reason, email) => {
    it("answers the field errors, the form's input as typed and the form message", async () => {
      const result = await requestPasswordResetAction(null, resetForm(email));

      expect(result).toEqual({
        errors: { email: [INVALID_EMAIL] },
        inputs: { email },
        message: FORM_ERRORS,
        success: false,
      });
    });

    it("checks no rate limit, never asks better-auth and never navigates", async () => {
      await requestPasswordResetAction(null, resetForm(email));

      expect(getClientIP).not.toHaveBeenCalled();
      expect(assertWithinRateLimit).not.toHaveBeenCalled();
      expect(auth.api.requestPasswordReset).not.toHaveBeenCalled();
      expectNoNavigation();
    });
  });

  it("answers a form without an email field as a blank email", async () => {
    const result = await requestPasswordResetAction(null, new FormData());

    expect(result).toEqual({
      errors: { email: [INVALID_EMAIL] },
      inputs: { email: "" },
      message: FORM_ERRORS,
      success: false,
    });
    expect(assertWithinRateLimit).not.toHaveBeenCalled();
    expect(auth.api.requestPasswordReset).not.toHaveBeenCalled();
  });

  it("keeps a malformed email out of every log", async () => {
    await requestPasswordResetAction(null, resetForm(MALFORMED_EMAIL));

    expectEmailNotLogged(MALFORMED_EMAIL);
  });

  it("checks the passwordReset rate limit once, with the trimmed email and the client ip", async () => {
    await requestPasswordResetAction(null, resetForm(PADDED_EMAIL));

    expect(getClientIP).toHaveBeenCalled();
    expect(vi.mocked(assertWithinRateLimit).mock.calls).toStrictEqual([["passwordReset", { email: EMAIL, ip: IP }]]);
  });

  it("passes the ip as null when the request has none", async () => {
    vi.mocked(getClientIP).mockResolvedValue(null);

    await requestPasswordResetAction(null, resetForm());

    expect(vi.mocked(assertWithinRateLimit).mock.calls).toStrictEqual([["passwordReset", { email: EMAIL, ip: null }]]);
  });

  it("checks the rate limit before asking better-auth for the link", async () => {
    await requestPasswordResetAction(null, resetForm());

    expect(auth.api.requestPasswordReset).toHaveBeenCalledOnce();
    expect(vi.mocked(assertWithinRateLimit).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(auth.api.requestPasswordReset).mock.invocationCallOrder[0],
    );
  });

  it("asks better-auth with exactly the trimmed email, the reset page and the request's own headers", async () => {
    const requestHeaders = new Headers({ host: "staging-adviente.vercel.app", "x-test": "request-headers" });
    vi.mocked(headers).mockResolvedValueOnce(requestHeaders as Awaited<ReturnType<typeof headers>>);

    await requestPasswordResetAction(null, resetForm(PADDED_EMAIL));

    expect(vi.mocked(auth.api.requestPasswordReset).mock.calls).toStrictEqual([
      [{ body: { email: EMAIL, redirectTo: "/reset-password" }, headers: requestHeaders }],
    ]);
    expect(vi.mocked(auth.api.requestPasswordReset).mock.calls[0][0]?.headers).toBe(requestHeaders);
  });

  describe("when the attempt is rate-limited", () => {
    beforeEach(() => {
      vi.mocked(assertWithinRateLimit).mockRejectedValue(new RateLimitError(TOO_MANY_HOUR));
    });

    it("answers the limiter's message with the form's input as typed and never asks better-auth", async () => {
      const result = await requestPasswordResetAction(null, resetForm(PADDED_EMAIL));

      expect(result).toEqual({ inputs: { email: PADDED_EMAIL }, message: TOO_MANY_HOUR, success: false });
      expect(auth.api.requestPasswordReset).not.toHaveBeenCalled();
      expectNoNavigation();
    });

    it("answers with whatever message the rate limiter threw", async () => {
      const thrown = "Mensaje de prueba del limitador";
      vi.mocked(assertWithinRateLimit).mockRejectedValue(new RateLimitError(thrown));

      const result = await requestPasswordResetAction(null, resetForm());

      expect(result).toEqual({ inputs: { email: EMAIL }, message: thrown, success: false });
    });

    it("logs it as an expected rejection with console.warn, not console.error", async () => {
      await requestPasswordResetAction(null, resetForm());

      expect(warn).toHaveBeenCalledWith("[requestPasswordResetAction] rejected: rate limit");
      expect(error).not.toHaveBeenCalled();
    });

    it("keeps the email out of every log", async () => {
      await requestPasswordResetAction(null, resetForm(PADDED_EMAIL));

      expectEmailNotLogged(PADDED_EMAIL);
    });
  });

  describe.each(LIMITER_FAILURES)("when the rate limiter fails because %s", (_reason, failure) => {
    beforeEach(() => {
      vi.mocked(assertWithinRateLimit).mockRejectedValue(failure);
    });

    it("fails closed: never asks better-auth, answers the generic message with the form's input", async () => {
      const result = await requestPasswordResetAction(null, resetForm(PADDED_EMAIL));

      expect(result).toEqual({ inputs: { email: PADDED_EMAIL }, message: RESET_FAILED, success: false });
      expect(auth.api.requestPasswordReset).not.toHaveBeenCalled();
      expectNoNavigation();
    });

    it("logs the failure with console.error", async () => {
      await requestPasswordResetAction(null, resetForm());

      expect(error).toHaveBeenCalledWith("[requestPasswordResetAction] unexpected error", failure);
    });

    it("keeps the email out of every log", async () => {
      await requestPasswordResetAction(null, resetForm(PADDED_EMAIL));

      expectEmailNotLogged(PADDED_EMAIL);
    });
  });

  describe("when better-auth fails", () => {
    const failure = new Error("Resend is down");

    beforeEach(() => {
      vi.mocked(auth.api.requestPasswordReset).mockRejectedValue(failure);
    });

    it("answers the generic message with the form's input as typed", async () => {
      const result = await requestPasswordResetAction(null, resetForm(PADDED_EMAIL));

      expect(result).toEqual({ inputs: { email: PADDED_EMAIL }, message: RESET_FAILED, success: false });
      expectNoNavigation();
    });

    it("logs the failure with console.error", async () => {
      await requestPasswordResetAction(null, resetForm());

      expect(error).toHaveBeenCalledWith("[requestPasswordResetAction] unexpected error", failure);
    });

    it("keeps the email out of every log", async () => {
      await requestPasswordResetAction(null, resetForm(PADDED_EMAIL));

      expectEmailNotLogged(PADDED_EMAIL);
    });
  });

  it("answers exactly the success message, without inputs or errors, and never navigates", async () => {
    const result = await requestPasswordResetAction(null, resetForm());

    expect(result).toStrictEqual(SUCCESS);
    expectNoNavigation();
  });

  it.each(AUTH_ANSWERS)("answers the success message when %s", async (_reason, answer) => {
    vi.mocked(auth.api.requestPasswordReset).mockResolvedValue(answer as never);

    const result = await requestPasswordResetAction(null, resetForm(UNKNOWN_EMAIL));

    expect(result).toStrictEqual(SUCCESS);
  });

  it("gives a known and an unknown email the very same answer", async () => {
    vi.mocked(auth.api.requestPasswordReset).mockResolvedValueOnce(AUTH_ANSWERS[0][1] as never);
    const known = await requestPasswordResetAction(null, resetForm(EMAIL));
    vi.mocked(auth.api.requestPasswordReset).mockResolvedValueOnce(AUTH_ANSWERS[1][1] as never);
    const unknown = await requestPasswordResetAction(null, resetForm(UNKNOWN_EMAIL));

    expect(unknown).toStrictEqual(known);
    expect(known).toStrictEqual(SUCCESS);
  });

  it("keeps the email out of every log on success", async () => {
    await requestPasswordResetAction(null, resetForm(PADDED_EMAIL));

    expectEmailNotLogged(PADDED_EMAIL);
  });
});

describe("resetPasswordAction", () => {
  const FORM_ERRORS = "Hay errores en el formulario";
  const LINK_INVALID = "El enlace no es válido. Pide uno nuevo.";
  const LINK_REJECTED = "El enlace no es válido o ha caducado. Pide uno nuevo.";
  const RESET_FAILED = "No se pudo cambiar la contraseña. Inténtalo de nuevo.";
  const PASSWORDS_DIFFER = "Las contraseñas no coinciden.";
  const PASSWORD_TOO_SHORT = "La contraseña debe ser de al menos 8 caracteres.";
  const SIGN_IN_AFTER_RESET = "/sign-in?password-reset=ok";
  const TOKEN = "rst7Kq2ZxV9pLm4Wn8Tb";
  const PADDED_TOKEN = `  ${TOKEN}  `;
  const NEW_PASSWORD = "Nuev4Clave!Ana";
  const OTHER_PASSWORD = "Distint4Clave!Luis";
  const WEAK_PASSWORD = "Zq9!x";
  type ResetField = "newPassword" | "newPasswordConfirmation" | "token";

  let log: MockInstance<typeof console.log>;
  let info: MockInstance<typeof console.info>;
  let debug: MockInstance<typeof console.debug>;

  function resetValues(fields: Partial<Record<ResetField, string>> = {}): Record<ResetField, string> {
    return { newPassword: NEW_PASSWORD, newPasswordConfirmation: NEW_PASSWORD, token: TOKEN, ...fields };
  }

  function resetForm(fields: Partial<Record<ResetField, string>> = {}) {
    const formData = new FormData();
    for (const [key, value] of Object.entries(resetValues(fields))) {
      formData.append(key, value);
    }
    return formData;
  }

  /** The field errors the real form schema gives for those values. */
  function fieldErrorsFor(values: Partial<Record<ResetField, string>>) {
    const parsed = resetPasswordFormSchema.safeParse(values);
    if (parsed.success) {
      throw new Error("these values are valid: the test expects them to fail");
    }
    return z.flattenError(parsed.error).fieldErrors;
  }

  /** Neither the token nor any password, as typed or trimmed, shows up in anything written to the console. */
  function expectSecretsNotLogged(...extra: string[]) {
    const logged = loggedText(warn, error, log, info, debug);
    for (const secret of [TOKEN, NEW_PASSWORD, OTHER_PASSWORD, WEAK_PASSWORD, ...extra]) {
      expect(logged).not.toContain(secret);
      expect(logged).not.toContain(secret.trim());
    }
  }

  function expectNoNavigation() {
    expect(redirect).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  }

  beforeEach(() => {
    log = vi.spyOn(console, "log").mockImplementation(() => {});
    info = vi.spyOn(console, "info").mockImplementation(() => {});
    debug = vi.spyOn(console, "debug").mockImplementation(() => {});
    vi.mocked(auth.api.resetPassword).mockResolvedValue({ status: true } as never);
  });

  afterEach(() => {
    log.mockRestore();
    info.mockRestore();
    debug.mockRestore();
  });

  describe.each<[string, Partial<Record<ResetField, string>>, ResetField, string]>([
    ["a blank token", { token: "" }, "token", LINK_INVALID],
    ["a token of spaces only", { token: "   " }, "token", LINK_INVALID],
    ["a blank new password", { newPassword: "", newPasswordConfirmation: "" }, "newPassword", PASSWORD_TOO_SHORT],
    [
      "a new password that breaks the password rules",
      { newPassword: WEAK_PASSWORD, newPasswordConfirmation: WEAK_PASSWORD },
      "newPassword",
      PASSWORD_TOO_SHORT,
    ],
    [
      "a confirmation that does not match",
      { newPasswordConfirmation: OTHER_PASSWORD },
      "newPasswordConfirmation",
      PASSWORDS_DIFFER,
    ],
  ])("with %s", (_reason, fields, field, fieldMessage) => {
    it("answers the schema's field errors and the form message", async () => {
      const result = await resetPasswordAction(null, resetForm(fields));

      expect(result).toEqual({ errors: fieldErrorsFor(resetValues(fields)), message: FORM_ERRORS, success: false });
      expect(result.errors?.[field]).toContain(fieldMessage);
    });

    it("never sends back the form's inputs", async () => {
      const result = await resetPasswordAction(null, resetForm(fields));

      expect(result).not.toHaveProperty("inputs");
    });

    it("never asks better-auth, checks no rate limit and never navigates", async () => {
      await resetPasswordAction(null, resetForm(fields));

      expect(auth.api.resetPassword).not.toHaveBeenCalled();
      expect(assertWithinRateLimit).not.toHaveBeenCalled();
      expectNoNavigation();
    });

    it("keeps the token and the passwords out of every log", async () => {
      await resetPasswordAction(null, resetForm(fields));

      expectSecretsNotLogged();
    });
  });

  it("answers a form without any field with the token and password errors, without inputs", async () => {
    const result = await resetPasswordAction(null, new FormData());

    expect(result).toEqual({
      errors: fieldErrorsFor({ newPassword: "", newPasswordConfirmation: "", token: "" }),
      message: FORM_ERRORS,
      success: false,
    });
    expect(result.errors?.token).toEqual([LINK_INVALID]);
    expect(result.errors?.newPassword).toContain(PASSWORD_TOO_SHORT);
    expect(result).not.toHaveProperty("inputs");
    expect(auth.api.resetPassword).not.toHaveBeenCalled();
    expectNoNavigation();
  });

  it("asks better-auth once with exactly the new password and the trimmed token", async () => {
    await resetPasswordAction(null, resetForm({ token: PADDED_TOKEN })).catch(() => undefined);

    expect(vi.mocked(auth.api.resetPassword).mock.calls).toStrictEqual([
      [{ body: { newPassword: NEW_PASSWORD, token: TOKEN } }],
    ]);
  });

  it("hands better-auth the new password as the form schema leaves it", async () => {
    const padded = `  ${NEW_PASSWORD} `;

    await resetPasswordAction(null, resetForm({ newPassword: padded, newPasswordConfirmation: padded })).catch(
      () => undefined,
    );

    expect(vi.mocked(auth.api.resetPassword).mock.calls).toStrictEqual([
      [{ body: { newPassword: NEW_PASSWORD, token: TOKEN } }],
    ]);
  });

  describe.each([
    ["INVALID_TOKEN", "Invalid token"],
    ["USER_NOT_FOUND", "User not found"],
  ])("when better-auth rejects the link with %s", (code, authMessage) => {
    beforeEach(() => {
      vi.mocked(auth.api.resetPassword).mockRejectedValue(new APIError("BAD_REQUEST", { code, message: authMessage }));
    });

    it("answers the rejected-link error on the token field, without inputs", async () => {
      const result = await resetPasswordAction(null, resetForm());

      expect(result).toStrictEqual({ errors: { token: [LINK_REJECTED] }, message: LINK_REJECTED, success: false });
    });

    it("logs it as an expected rejection with console.warn, not console.error", async () => {
      await resetPasswordAction(null, resetForm());

      expect(warn.mock.calls).toStrictEqual([["[resetPasswordAction] rejected: invalid token"]]);
      expect(error).not.toHaveBeenCalled();
    });

    it("never navigates", async () => {
      await resetPasswordAction(null, resetForm());

      expectNoNavigation();
    });

    it("keeps the token and the passwords out of every log", async () => {
      await resetPasswordAction(null, resetForm({ token: PADDED_TOKEN }));

      expectSecretsNotLogged(PADDED_TOKEN);
    });
  });

  describe.each<[string, Error]>([
    [
      "another better-auth error",
      new APIError("BAD_REQUEST", { code: "PASSWORD_TOO_SHORT", message: "Password too short" }),
    ],
    ["an unexpected error", new Error("Can't reach database server")],
    [
      "an error that is not an APIError but carries the invalid-token code",
      Object.assign(new Error("Invalid token"), { body: { code: "INVALID_TOKEN" } }),
    ],
  ])("when better-auth fails with %s", (_reason, failure) => {
    beforeEach(() => {
      vi.mocked(auth.api.resetPassword).mockRejectedValue(failure);
    });

    it("answers exactly the generic message", async () => {
      const result = await resetPasswordAction(null, resetForm());

      expect(result).toStrictEqual({ message: RESET_FAILED, success: false });
    });

    it("logs the failure with console.error, and no rejection warning", async () => {
      await resetPasswordAction(null, resetForm());

      expect(error.mock.calls).toStrictEqual([["[resetPasswordAction] unexpected error", failure]]);
      expect(warn).not.toHaveBeenCalled();
    });

    it("never navigates", async () => {
      await resetPasswordAction(null, resetForm());

      expectNoNavigation();
    });

    it("keeps the token and the passwords out of every log", async () => {
      await resetPasswordAction(null, resetForm({ token: PADDED_TOKEN }));

      expectSecretsNotLogged(PADDED_TOKEN);
    });
  });

  describe("when better-auth changes the password", () => {
    it("redirects to exactly the sign-in page with the reset notice", async () => {
      await expect(resetPasswordAction(null, resetForm())).rejects.toThrow("NEXT_REDIRECT");

      expect(vi.mocked(redirect).mock.calls).toStrictEqual([[SIGN_IN_AFTER_RESET]]);
    });

    it("lets the redirect's own error reach Next.js instead of swallowing it", async () => {
      await expect(resetPasswordAction(null, resetForm())).rejects.toMatchObject({
        digest: expect.stringContaining(SIGN_IN_AFTER_RESET),
      });
    });

    it("redirects only after better-auth has changed the password", async () => {
      await resetPasswordAction(null, resetForm()).catch(() => undefined);

      expect(auth.api.resetPassword).toHaveBeenCalledOnce();
      expect(redirect).toHaveBeenCalledOnce();
      expect(vi.mocked(auth.api.resetPassword).mock.invocationCallOrder[0]).toBeLessThan(
        vi.mocked(redirect).mock.invocationCallOrder[0],
      );
    });

    it("checks no rate limit and revalidates nothing", async () => {
      await resetPasswordAction(null, resetForm()).catch(() => undefined);

      expect(getClientIP).not.toHaveBeenCalled();
      expect(assertWithinRateLimit).not.toHaveBeenCalled();
      expect(revalidatePath).not.toHaveBeenCalled();
    });

    it("logs no error and keeps the token and the passwords out of every log", async () => {
      await resetPasswordAction(null, resetForm({ token: PADDED_TOKEN })).catch(() => undefined);

      expect(error).not.toHaveBeenCalled();
      expectSecretsNotLogged(PADDED_TOKEN);
    });
  });
});

describe("updateUserProfile", () => {
  const USER_ID = "user-1";
  const OLD_AVATAR = "advientea-local/avatars/old";
  const NEW_AVATAR = "advientea-local/avatars/new";
  const PROFILE_FAILED = "No se pudo actualizar el perfil. Inténtalo de nuevo.";
  const INITIAL_STATE = { message: "", success: false };
  const session = {
    isAuth: true as const,
    role: "USER" as const,
    user: { email: EMAIL, id: USER_ID, image: OLD_AVATAR, name: "Ana", username: "Ana" },
    userId: USER_ID,
  };
  type Session = Awaited<ReturnType<typeof requireSession>>;
  type ProfileField = "currentPassword" | "newPassword" | "newPasswordConfirmation" | "username";

  function avatarFile() {
    return new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], "avatar.png", {
      type: "image/png",
    });
  }

  /** A profile form as the page sends it: the password fields always present, empty when unchanged. */
  function profileForm(fields: Partial<Record<ProfileField, string>> = {}, image: File = avatarFile()) {
    const formData = new FormData();
    const values = { currentPassword: "", newPassword: "", newPasswordConfirmation: "", username: "Ana", ...fields };
    for (const [key, value] of Object.entries(values)) {
      formData.append(key, value);
    }
    formData.append("image", image);
    return formData;
  }

  function passwordChangeForm(image?: File) {
    return profileForm(
      { currentPassword: "Actual123!", newPassword: "Nueva123!", newPasswordConfirmation: "Nueva123!" },
      image,
    );
  }

  function expectNothingChanged() {
    expect(uploadImage).not.toHaveBeenCalled();
    expect(auth.api.changePassword).not.toHaveBeenCalled();
    expect(editUser).not.toHaveBeenCalled();
    expect(deleteAsset).not.toHaveBeenCalled();
  }

  beforeEach(() => {
    vi.mocked(requireSession).mockResolvedValue(session as unknown as Session);
    vi.mocked(uploadImage).mockResolvedValue(NEW_AVATAR);
    vi.mocked(auth.api.changePassword).mockResolvedValue({ token: null, user: {} } as never);
    vi.mocked(editUser).mockResolvedValue({ id: USER_ID, image: NEW_AVATAR, username: "Ana" } as never);
  });

  it("checks the changePassword rate limit with the session's user id only, when the password changes", async () => {
    await updateUserProfile(INITIAL_STATE, passwordChangeForm()).catch(() => undefined);

    expect(vi.mocked(assertWithinRateLimit).mock.calls).toStrictEqual([["changePassword", { userId: USER_ID }]]);
  });

  it("checks the rate limit before uploading the avatar and before changing the password", async () => {
    await updateUserProfile(INITIAL_STATE, passwordChangeForm()).catch(() => undefined);

    const limiterCall = vi.mocked(assertWithinRateLimit).mock.invocationCallOrder[0];
    expect(uploadImage).toHaveBeenCalled();
    expect(auth.api.changePassword).toHaveBeenCalled();
    expect(limiterCall).toBeLessThan(vi.mocked(uploadImage).mock.invocationCallOrder[0]);
    expect(limiterCall).toBeLessThan(vi.mocked(auth.api.changePassword).mock.invocationCallOrder[0]);
  });

  it("never checks the rate limit for a profile update that keeps the password", async () => {
    await updateUserProfile(INITIAL_STATE, profileForm({ username: "Ana María" })).catch(() => undefined);

    expect(uploadImage).toHaveBeenCalled();
    expect(assertWithinRateLimit).not.toHaveBeenCalled();
  });

  it("never checks the rate limit when only the current password is filled in", async () => {
    await updateUserProfile(INITIAL_STATE, profileForm({ currentPassword: "Actual123!" })).catch(() => undefined);

    expect(assertWithinRateLimit).not.toHaveBeenCalled();
  });

  it.each([
    [
      "the new password is too weak",
      { currentPassword: "Actual123!", newPassword: "corta", newPasswordConfirmation: "corta" },
    ],
    [
      "the confirmation does not match",
      { currentPassword: "Actual123!", newPassword: "Nueva123!", newPasswordConfirmation: "Otra123!" },
    ],
    ["the current password is missing", { newPassword: "Nueva123!", newPasswordConfirmation: "Nueva123!" }],
  ])("never checks the rate limit for an invalid form: %s", async (_reason, fields) => {
    const result = await updateUserProfile(INITIAL_STATE, profileForm(fields));

    expect(result.success).toBe(false);
    expect(assertWithinRateLimit).not.toHaveBeenCalled();
    expectNothingChanged();
  });

  it("never checks the rate limit without a session", async () => {
    vi.mocked(requireSession).mockRejectedValue(new UnauthenticatedError());

    await updateUserProfile(INITIAL_STATE, passwordChangeForm()).catch(() => undefined);

    expect(assertWithinRateLimit).not.toHaveBeenCalled();
    expectNothingChanged();
  });

  describe("when the attempt is rate-limited", () => {
    beforeEach(() => {
      vi.mocked(assertWithinRateLimit).mockRejectedValue(new RateLimitError(TOO_MANY));
    });

    it("answers with the limiter's message and changes nothing: no upload, no password, no user, no delete", async () => {
      const result = await updateUserProfile(INITIAL_STATE, passwordChangeForm());

      expect(result).toEqual({ message: TOO_MANY, success: false });
      expectNothingChanged();
    });

    it("answers with whatever message the rate limiter threw", async () => {
      const thrown = "Mensaje de prueba del limitador";
      vi.mocked(assertWithinRateLimit).mockRejectedValue(new RateLimitError(thrown));

      const result = await updateUserProfile(INITIAL_STATE, passwordChangeForm());

      expect(result).toEqual({ message: thrown, success: false });
    });

    it("logs it as an expected rejection with console.warn, not console.error", async () => {
      await updateUserProfile(INITIAL_STATE, passwordChangeForm());

      expect(warn).toHaveBeenCalled();
      const warned = loggedText(warn);
      expect(warned).toContain("[updateUserProfile] rejected");
      expect(warned).toContain("RateLimitError");
      expect(warned).toContain(TOO_MANY);
      expect(error).not.toHaveBeenCalled();
    });
  });

  describe.each(LIMITER_FAILURES)("when the rate limiter fails because %s", (_reason, failure) => {
    beforeEach(() => {
      vi.mocked(assertWithinRateLimit).mockRejectedValue(failure);
    });

    it("answers the generic message and changes nothing", async () => {
      const result = await updateUserProfile(INITIAL_STATE, passwordChangeForm());

      expect(result).toMatchObject({ message: PROFILE_FAILED, success: false });
      expectNothingChanged();
    });

    it("logs the failure with console.error", async () => {
      await updateUserProfile(INITIAL_STATE, passwordChangeForm());

      expect(error).toHaveBeenCalled();
    });
  });
});

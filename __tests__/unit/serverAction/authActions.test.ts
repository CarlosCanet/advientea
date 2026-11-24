import { APIError } from "better-auth/api";
import { redirect } from "next/navigation";
import { inspect } from "node:util";
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from "vitest";

import { signin, signup } from "@/app/actions/authActions";
import { auth } from "@/lib/auth";
import { uploadImage } from "@/lib/cloudinary";
import { RateLimitError } from "@/lib/errors";
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
    vi.mocked(assertWithinRateLimit).mockRejectedValue(new RateLimitError());

    const result = await signin(null, signinForm());

    expect(result).toEqual({ errors: { password: [TOO_MANY] }, message: TOO_MANY, success: false });
    expect(auth.api.signInEmail).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("keeps the email and the ip out of the logs when an attempt is rate-limited", async () => {
    vi.mocked(assertWithinRateLimit).mockRejectedValue(new RateLimitError());

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
    vi.mocked(assertWithinRateLimit).mockRejectedValue(new RateLimitError());

    const result = await signup(null, signupForm());

    expect(result).toEqual({ errors: { errors: [TOO_MANY] }, message: TOO_MANY, success: false });
    expect(createUser).not.toHaveBeenCalled();
    expect(uploadImage).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("keeps the email and the ip out of the logs when an attempt is rate-limited", async () => {
    vi.mocked(assertWithinRateLimit).mockRejectedValue(new RateLimitError());

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

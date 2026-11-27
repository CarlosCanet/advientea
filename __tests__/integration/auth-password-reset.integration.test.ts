// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/lib/prisma";

type AfterTask = (() => unknown) | Promise<unknown>;

const { after, recordedTasks, sendResetPasswordEmail } = vi.hoisted(() => {
  const recordedTasks: AfterTask[] = [];
  return {
    after: vi.fn((task: AfterTask) => {
      recordedTasks.push(task);
    }),
    recordedTasks,
    sendResetPasswordEmail: vi.fn(),
  };
});

// after() needs a Next.js request scope; here it only records the task so a test decides when it runs.
vi.mock("next/server", async (importOriginal) => {
  const original = await importOriginal<typeof import("next/server")>();
  return { ...original, after };
});

vi.mock("@/lib/services/password-reset-service", () => ({ sendResetPasswordEmail }));

// The setup file loads @/lib/auth (through the seed) before these mocks apply, so the cached module
// keeps the real after(); a fresh copy picks up the mocks. auth.ts also reads VERCEL_ENV when it
// loads, so every mode gets its own copy. Prisma stays one client (globalThis cache) on the test DB.
let auth: (typeof import("@/lib/auth"))["auth"];

interface AuthEnv {
  BETTER_AUTH_URL?: string;
  PRODUCTION_DB_HOST?: string;
  VERCEL_ENV?: string;
}

async function loadAuth(env: AuthEnv = {}) {
  vi.unstubAllEnvs();
  vi.stubEnv("VERCEL_ENV", env.VERCEL_ENV);
  if (env.BETTER_AUTH_URL !== undefined) {
    vi.stubEnv("BETTER_AUTH_URL", env.BETTER_AUTH_URL);
  }
  if (env.PRODUCTION_DB_HOST !== undefined) {
    vi.stubEnv("PRODUCTION_DB_HOST", env.PRODUCTION_DB_HOST);
  }
  vi.resetModules();
  ({ auth } = await import("@/lib/auth"));
}

/** Local development and tests: VERCEL_ENV unset, BETTER_AUTH_URL from .env.test. */
function loadDefaultAuth() {
  return loadAuth();
}

beforeAll(loadDefaultAuth);

afterAll(() => {
  vi.unstubAllEnvs();
});

const REDIRECT_TO = "/reset-password";
const CALLBACK_SUFFIX = "?callbackURL=%2Freset-password";
const RESET_PATH = "/api/auth/reset-password/";
const ONE_HOUR_MS = 60 * 60 * 1000;
/** An allowed host in the default (unset) mode whose port differs from BETTER_AUTH_URL's. */
const DEFAULT_HOST = "localhost:4123";
const DEFAULT_ORIGIN = "http://localhost:4123";

/** Fallback for the host tests, distinct from every host a request sends, so a fallback is unmistakable. */
const BASE_URL = "https://base-url.example.test";
/** Not the test database host, so the preview guard in @/lib/prisma lets the test DB through. */
const NOT_THE_TEST_DB_HOST = "production-db.invalid";

const STAGING_HOST = "staging-adviente.vercel.app";
const PRODUCTION_HOST = "adviente.vercel.app";
const PREVIEW_HOST = "advientea-git-feat-x-carloscs-projects-ed0bbe86.vercel.app";

const ACCOUNT = { email: "ana.reset@example.com", name: "AnaReset", password: "Secreto123!", username: "AnaReset" };
const OTHER = { email: "luis.reset@example.com", name: "LuisReset", password: "Secreto456!", username: "LuisReset" };
const NEW_PASSWORD = "NuevoSecreto789!";

/** BETTER_AUTH_URL from .env.test, which auth.ts reads as the fallback; trailing slashes do not count. */
function fallbackResetPrefix() {
  const base = process.env.BETTER_AUTH_URL!.replace(/\/+$/, "");
  return `${base}${RESET_PATH}`;
}

async function runRecordedTasks() {
  for (const task of recordedTasks.splice(0)) {
    await (typeof task === "function" ? task() : task);
  }
}

function requestReset(email: string, headers: Headers = new Headers({ host: DEFAULT_HOST })) {
  return auth.api.requestPasswordReset({ body: { email, redirectTo: REDIRECT_TO }, headers });
}

/** Requests a reset, runs the background task and returns what the email service received. */
async function requestResetAndCapture(email: string, headers?: Headers) {
  await requestReset(email, headers);
  await runRecordedTasks();
  expect(sendResetPasswordEmail).toHaveBeenCalledTimes(1);
  return sendResetPasswordEmail.mock.calls[0][0] as { url: string; user: { email: string; name: string } };
}

function toToken(url: string) {
  const { pathname } = new URL(url);
  const token = pathname.slice(pathname.indexOf(RESET_PATH) + RESET_PATH.length);
  expect(token).not.toBe("");
  return token;
}

/** Turns the Set-Cookie headers of a response into the Cookie header a browser would send back. */
function toCookieHeader(headers: Headers) {
  return headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
}

async function signIn(email: string, password: string) {
  const { headers, response } = await auth.api.signInEmail({ body: { email, password }, returnHeaders: true });
  return { cookie: toCookieHeader(headers), userId: response.user.id };
}

async function sessionUserId(cookie: string) {
  const session = await auth.api.getSession({ headers: new Headers({ cookie }) });
  return session?.user.id ?? null;
}

describe("password reset through better-auth", () => {
  beforeEach(() => {
    recordedTasks.length = 0;
    vi.clearAllMocks();
    sendResetPasswordEmail.mockResolvedValue(undefined);
  });

  describe("reset url host", () => {
    afterAll(loadDefaultAuth);

    beforeEach(async () => {
      await auth.api.signUpEmail({ body: ACCOUNT });
    });

    interface HostMode {
      allowed: [host: string, origin: string][];
      env: AuthEnv;
      /** null: the request has no host header. */
      fallback: (null | string)[];
      /** A host this mode would accept, sent only as x-forwarded-host. */
      spoofedHost: string;
    }

    function describeHostMode(name: string, { allowed, env, fallback, spoofedHost }: HostMode) {
      describe(name, () => {
        beforeAll(async () => {
          await loadAuth(env);
        });

        if (allowed.length > 0) {
          it.each(allowed)("builds the url from the allowed host %s", async (host, origin) => {
            const { url } = await requestResetAndCapture(ACCOUNT.email, new Headers({ host }));

            expect(url.startsWith(`${origin}${RESET_PATH}`)).toBe(true);
          });
        }

        it.each(fallback.map((host) => [host ?? "(no host header)", host] as const))(
          "falls back to BETTER_AUTH_URL for %s",
          async (_label, host) => {
            const { url } = await requestResetAndCapture(
              ACCOUNT.email,
              host === null ? new Headers() : new Headers({ host }),
            );

            expect(url.startsWith(fallbackResetPrefix())).toBe(true);
            if (host !== null) {
              expect(url).not.toContain(host);
            }
          },
        );

        it(`ignores x-forwarded-host: a spoofed ${spoofedHost} with host evil.example falls back`, async () => {
          const headers = new Headers({
            host: "evil.example",
            "x-forwarded-host": spoofedHost,
            "x-forwarded-proto": "https",
          });

          const { url } = await requestResetAndCapture(ACCOUNT.email, headers);

          expect(url.startsWith(fallbackResetPrefix())).toBe(true);
          expect(url).not.toContain("evil.example");
          expect(url).not.toContain(spoofedHost);
        });
      });
    }

    describeHostMode("VERCEL_ENV=production", {
      allowed: [],
      env: { BETTER_AUTH_URL: BASE_URL, PRODUCTION_DB_HOST: NOT_THE_TEST_DB_HOST, VERCEL_ENV: "production" },
      fallback: [PRODUCTION_HOST, STAGING_HOST, PREVIEW_HOST, "localhost:3700", "evil.example", null],
      spoofedHost: PRODUCTION_HOST,
    });

    describeHostMode("VERCEL_ENV=preview", {
      allowed: [
        [STAGING_HOST, `https://${STAGING_HOST}`],
        [PREVIEW_HOST, `https://${PREVIEW_HOST}`],
      ],
      env: { BETTER_AUTH_URL: BASE_URL, PRODUCTION_DB_HOST: NOT_THE_TEST_DB_HOST, VERCEL_ENV: "preview" },
      fallback: [
        PRODUCTION_HOST,
        "localhost:3700",
        "evil.example",
        "evil.vercel.app",
        "advientea-git-x-someone-else.vercel.app",
        null,
      ],
      spoofedHost: STAGING_HOST,
    });

    describeHostMode("VERCEL_ENV unset", {
      allowed: [
        ["localhost:3700", "http://localhost:3700"],
        ["localhost:4123", "http://localhost:4123"],
      ],
      env: { BETTER_AUTH_URL: BASE_URL },
      fallback: [PRODUCTION_HOST, STAGING_HOST, PREVIEW_HOST, "evil.example", null],
      spoofedHost: "localhost:4123",
    });

    it("ends the url with the encoded callbackURL from redirectTo", async () => {
      const { url } = await requestResetAndCapture(ACCOUNT.email);

      expect(url.endsWith(CALLBACK_SUFFIX)).toBe(true);
    });
  });

  describe("sending the email", () => {
    it("hands the email to after() and does not call the service inside the request", async () => {
      await auth.api.signUpEmail({ body: ACCOUNT });

      const result = await requestReset(ACCOUNT.email);

      expect(result).toMatchObject({ status: true });
      expect(after).toHaveBeenCalledTimes(1);
      expect(recordedTasks).toHaveLength(1);
      expect(sendResetPasswordEmail).not.toHaveBeenCalled();
    });

    it("calls the service with the url and the user once the recorded task runs", async () => {
      const created = await auth.api.signUpEmail({ body: ACCOUNT });

      await requestReset(ACCOUNT.email);
      await runRecordedTasks();

      expect(sendResetPasswordEmail).toHaveBeenCalledTimes(1);
      const [{ url, user }] = sendResetPasswordEmail.mock.calls[0] as [
        { url: string; user: { email: string; id: string; name: string } },
      ];
      expect(url.startsWith(`${DEFAULT_ORIGIN}${RESET_PATH}`)).toBe(true);
      expect(url.endsWith(CALLBACK_SUFFIX)).toBe(true);
      expect(user).toMatchObject({ email: ACCOUNT.email, id: created.user.id, name: ACCOUNT.name });
    });

    it("answers an unknown email the same way and records nothing", async () => {
      await auth.api.signUpEmail({ body: ACCOUNT });
      const known = await requestReset(ACCOUNT.email);
      recordedTasks.length = 0;
      vi.mocked(after).mockClear();
      const verificationsBefore = await prisma.verification.count();

      const unknown = await requestReset("nadie@example.com");
      await runRecordedTasks();

      expect(unknown).toEqual(known);
      expect(unknown).toMatchObject({ status: true });
      expect(after).not.toHaveBeenCalled();
      expect(sendResetPasswordEmail).not.toHaveBeenCalled();
      expect(await prisma.verification.count()).toBe(verificationsBefore);
    });
  });

  describe("the reset token", () => {
    it("resets the password, revokes the user's sessions and keeps another user's", async () => {
      const created = await auth.api.signUpEmail({ body: ACCOUNT });
      await auth.api.signUpEmail({ body: OTHER });
      const first = await signIn(ACCOUNT.email, ACCOUNT.password);
      const second = await signIn(ACCOUNT.email, ACCOUNT.password);
      const other = await signIn(OTHER.email, OTHER.password);
      expect(await sessionUserId(first.cookie)).toBe(created.user.id);
      expect(await sessionUserId(second.cookie)).toBe(created.user.id);
      const otherSessionsBefore = await prisma.session.count({ where: { userId: other.userId } });
      expect(otherSessionsBefore).toBeGreaterThan(0);
      const { url } = await requestResetAndCapture(ACCOUNT.email);

      const result = await auth.api.resetPassword({ body: { newPassword: NEW_PASSWORD, token: toToken(url) } });

      expect(result).toMatchObject({ status: true });
      expect(await prisma.session.count({ where: { userId: created.user.id } })).toBe(0);
      expect(await sessionUserId(first.cookie)).toBeNull();
      expect(await sessionUserId(second.cookie)).toBeNull();
      expect(await prisma.session.count({ where: { userId: other.userId } })).toBe(otherSessionsBefore);
      expect(await sessionUserId(other.cookie)).toBe(other.userId);
      await expect(
        auth.api.signInEmail({ body: { email: ACCOUNT.email, password: ACCOUNT.password } }),
      ).rejects.toThrow();
      const signedIn = await auth.api.signInEmail({ body: { email: ACCOUNT.email, password: NEW_PASSWORD } });
      expect(signedIn.user.id).toBe(created.user.id);
    });

    it("cannot be used twice", async () => {
      await auth.api.signUpEmail({ body: ACCOUNT });
      const { url } = await requestResetAndCapture(ACCOUNT.email);
      const token = toToken(url);
      await auth.api.resetPassword({ body: { newPassword: NEW_PASSWORD, token } });

      await expect(auth.api.resetPassword({ body: { newPassword: "OtroSecreto000!", token } })).rejects.toThrow();

      await expect(
        auth.api.signInEmail({ body: { email: ACCOUNT.email, password: "OtroSecreto000!" } }),
      ).rejects.toThrow();
      const signedIn = await auth.api.signInEmail({ body: { email: ACCOUNT.email, password: NEW_PASSWORD } });
      expect(signedIn.user.email).toBe(ACCOUNT.email);
    });

    it("is rejected once it has expired, and the password and sessions stay as they were", async () => {
      const created = await auth.api.signUpEmail({ body: ACCOUNT });
      const { url } = await requestResetAndCapture(ACCOUNT.email);
      const token = toToken(url);
      const { count } = await prisma.verification.updateMany({
        data: { expiresAt: new Date(Date.now() - 1000) },
        where: { value: created.user.id },
      });
      expect(count).toBe(1);
      const sessionsBefore = await prisma.session.count({ where: { userId: created.user.id } });

      await expect(auth.api.resetPassword({ body: { newPassword: NEW_PASSWORD, token } })).rejects.toThrow();

      expect(await prisma.session.count({ where: { userId: created.user.id } })).toBe(sessionsBefore);
      const signedIn = await auth.api.signInEmail({ body: { email: ACCOUNT.email, password: ACCOUNT.password } });
      expect(signedIn.user.id).toBe(created.user.id);
    });

    it("expires one hour after the request", async () => {
      const created = await auth.api.signUpEmail({ body: ACCOUNT });
      const before = Date.now();

      await requestReset(ACCOUNT.email);

      const afterRequest = Date.now();
      const row = await prisma.verification.findFirstOrThrow({ where: { value: created.user.id } });
      expect(row.expiresAt.getTime()).toBeGreaterThanOrEqual(before + ONE_HOUR_MS - 1000);
      expect(row.expiresAt.getTime()).toBeLessThanOrEqual(afterRequest + ONE_HOUR_MS + 1000);
    });
  });
});

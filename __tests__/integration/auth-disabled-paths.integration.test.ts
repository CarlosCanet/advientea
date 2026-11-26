// @vitest-environment node
import { describe, expect, it } from "vitest";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// BETTER_AUTH_URL comes from .env.test, loaded by @/envConfig when auth.ts and prisma.ts are imported.
function authUrl(path: string) {
  return `${process.env.BETTER_AUTH_URL}/api/auth${path}`;
}

function postJson(path: string, body: Record<string, unknown>, extraHeaders: Record<string, string> = {}) {
  return auth.handler(
    new Request(authUrl(path), {
      body: JSON.stringify(body),
      headers: { "content-type": "application/json", origin: process.env.BETTER_AUTH_URL!, ...extraHeaders },
      method: "POST",
    }),
  );
}

function requestWith(method: string, path: string) {
  const isGet = method === "GET";
  return auth.handler(
    new Request(authUrl(path), {
      body: isGet ? undefined : JSON.stringify({}),
      headers: { "content-type": "application/json", origin: process.env.BETTER_AUTH_URL! },
      method,
    }),
  );
}

type EndpointShape = { options?: { method?: string | string[] }; path?: unknown };

// The routes that stay reachable over HTTP; every other endpoint must answer 404.
const OPEN_PATHS = new Set(["/error", "/ok"]);

/**
 * Every endpoint better-auth registers, read from auth.api so a new endpoint (a plugin, an upgrade) is checked
 * without editing this list. Paths with a parameter are skipped: disabledPaths cannot close them, and the one the
 * app needs, the reset link, has its own test below.
 */
function toClosableEndpoints(api: Record<string, EndpointShape>): Array<[string, string]> {
  const seen = new Set<string>();
  const endpoints: Array<[string, string]> = [];
  for (const endpoint of Object.values(api)) {
    const { path } = endpoint;
    if (typeof path !== "string" || path.includes(":") || OPEN_PATHS.has(path)) {
      continue;
    }
    const declared = endpoint.options?.method;
    const first = Array.isArray(declared) ? declared[0] : declared;
    const method = !first || first === "*" ? "POST" : first;
    const id = `${method} ${path}`;
    if (!seen.has(id)) {
      seen.add(id);
      endpoints.push([method, path]);
    }
  }
  return endpoints;
}

const CLOSABLE_ENDPOINTS = toClosableEndpoints(auth.api as unknown as Record<string, EndpointShape>);

/** Turns the Set-Cookie headers of a response into the Cookie header a browser would send back. */
function toCookieHeader(headers: Headers) {
  return headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
}

const ACCOUNT = { email: "ana.http@example.com", name: "AnaHttp", password: "Secreto123!", username: "AnaHttp" };

async function createAccount() {
  return auth.api.signUpEmail({ body: ACCOUNT });
}

describe("better-auth HTTP endpoints", () => {
  it("answers the base path, so a 404 below comes from the closed paths and not from a wrong URL", async () => {
    const response = await auth.handler(new Request(authUrl("/ok")));

    expect(response.status).toBe(200);
  });

  describe("closed paths", () => {
    it("finds the endpoints to check in auth.api, the ones the app used to expose among them", () => {
      const paths = CLOSABLE_ENDPOINTS.map(([, path]) => path);

      expect(paths).toEqual(
        expect.arrayContaining([
          "/get-session",
          "/request-password-reset",
          "/reset-password",
          "/sign-in/email",
          "/sign-up/email",
          "/update-user",
        ]),
      );
    });

    it.each(CLOSABLE_ENDPOINTS)("%s %s answers 404", async (method, path) => {
      const response = await requestWith(method, path);

      expect(response.status).toBe(404);
    });

    it("does not sign in over HTTP even with the right credentials", async () => {
      await createAccount();
      const sessionsBefore = await prisma.session.count();

      const response = await postJson("/sign-in/email", { email: ACCOUNT.email, password: ACCOUNT.password });

      expect(response.status).toBe(404);
      expect(response.headers.get("set-cookie")).toBeNull();
      expect(await prisma.session.count()).toBe(sessionsBefore);
    });

    it("does not create an account over HTTP", async () => {
      const response = await postJson("/sign-up/email", {
        email: "nueva@example.com",
        name: "Nueva",
        password: "Secreto123!",
        username: "Nueva",
      });

      expect(response.status).toBe(404);
      expect(await prisma.user.count({ where: { email: "nueva@example.com" } })).toBe(0);
    });

    it("does not issue a password reset token over HTTP", async () => {
      await createAccount();
      const verificationsBefore = await prisma.verification.count();

      const response = await postJson("/request-password-reset", {
        email: ACCOUNT.email,
        redirectTo: "/reset-password",
      });

      expect(response.status).toBe(404);
      expect(await prisma.verification.count()).toBe(verificationsBefore);
    });

    it("does not let a signed-in user change their image over HTTP", async () => {
      const created = await createAccount();
      const { image: imageBefore } = await prisma.user.findUniqueOrThrow({ where: { id: created.user.id } });
      const { headers } = await auth.api.signInEmail({
        body: { email: ACCOUNT.email, password: ACCOUNT.password },
        returnHeaders: true,
      });
      const cookie = toCookieHeader(headers);
      // The cookie is a real session, so a 404 comes from the closed path and not from a rejected session.
      const session = await auth.api.getSession({ headers: new Headers({ cookie }) });
      expect(session?.user.id).toBe(created.user.id);

      const response = await postJson("/update-user", { image: "somebody-else" }, { cookie });

      expect(response.status).toBe(404);
      const { image: imageAfter } = await prisma.user.findUniqueOrThrow({ where: { id: created.user.id } });
      expect(imageAfter).toBe(imageBefore);
      expect(imageAfter).not.toBe("somebody-else");
    });
  });

  describe("server-side API", () => {
    it("still creates an account and signs in when called directly", async () => {
      const created = await createAccount();

      const signedIn = await auth.api.signInEmail({ body: { email: ACCOUNT.email, password: ACCOUNT.password } });

      expect(created.user.email).toBe(ACCOUNT.email);
      expect(signedIn.user).toMatchObject({ email: ACCOUNT.email, id: created.user.id });
    });
  });

  describe("reset link", () => {
    it("keeps GET /reset-password/<token> open: it redirects instead of answering 404", async () => {
      const response = await auth.handler(
        new Request(authUrl("/reset-password/any-token?callbackURL=/reset-password")),
      );

      expect(response.status).not.toBe(404);
      expect(response.status).toBeGreaterThanOrEqual(300);
      expect(response.status).toBeLessThan(400);
      expect(response.headers.get("location")).toContain("/reset-password");
    });
  });
});

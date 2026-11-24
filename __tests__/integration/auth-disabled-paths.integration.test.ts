// @vitest-environment node
import { describe, expect, it } from "vitest";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// BETTER_AUTH_URL comes from .env.test, loaded by @/envConfig when auth.ts and prisma.ts are imported.
function authUrl(path: string) {
  return `${process.env.BETTER_AUTH_URL}/api/auth${path}`;
}

function postJson(path: string, body: Record<string, unknown>) {
  return auth.handler(
    new Request(authUrl(path), {
      body: JSON.stringify(body),
      headers: { "content-type": "application/json", origin: process.env.BETTER_AUTH_URL! },
      method: "POST",
    }),
  );
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
    it.each([
      ["/sign-in/email", { email: ACCOUNT.email, password: ACCOUNT.password }],
      ["/sign-up/email", { email: "nueva@example.com", name: "Nueva", password: "Secreto123!", username: "Nueva" }],
      ["/request-password-reset", { email: ACCOUNT.email, redirectTo: "/reset-password" }],
      ["/reset-password", { newPassword: "OtraClave456!", token: "any-token" }],
    ])("POST %s answers 404", async (path, body) => {
      const response = await postJson(path, body);

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

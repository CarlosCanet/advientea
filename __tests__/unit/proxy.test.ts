// @vitest-environment node
import { getSessionCookie } from "better-auth/cookies";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { config, isPublicPath, proxy } from "@/proxy";

vi.mock("better-auth/cookies", () => ({ getSessionCookie: vi.fn() }));

const ORIGIN = "https://adviente.example";

function request(pathname: string, method = "GET") {
  return new NextRequest(`${ORIGIN}${pathname}`, { method });
}

/** A response that lets the request go on to the page: no redirect and no rewrite. */
function expectPassedThrough(response: Response | undefined | void) {
  if (!response) {
    return;
  }
  expect(response.headers.get("location"), "the proxy redirected").toBeNull();
  expect(response.headers.get("x-middleware-rewrite"), "the proxy rewrote").toBeNull();
  expect(response.status).toBeLessThan(300);
}

describe("isPublicPath", () => {
  it.each([
    "/",
    "/sign-in",
    "/sign-up",
    "/reset-password",
    "/teaDay",
    "/teaDay/day-id",
    "/timer",
    "/invitado",
    "/invitado/some-token",
  ])("lets anyone see %s", (pathname) => {
    expect(isPublicPath(pathname)).toBe(true);
  });

  it.each([
    "/my-tea",
    "/users",
    "/editions/2026",
    "/ranking",
    "/profile",
    "/edit-tea-info/tea-id",
    "/add-tea-info",
    "/invitadoX",
    "/teaDayfoo",
  ])("asks for a session on %s", (pathname) => {
    expect(isPublicPath(pathname)).toBe(false);
  });
});

describe("proxy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("the proxy must not call the network"));
  });

  it("lets a visitor without a session cookie reach a public path, a guest's form post included", async () => {
    vi.mocked(getSessionCookie).mockReturnValue(null);

    expectPassedThrough(await proxy(request("/invitado", "POST")));
  });

  it("sends a visitor without a session cookie on a protected path to sign in", async () => {
    vi.mocked(getSessionCookie).mockReturnValue(null);

    const response = await proxy(request("/my-tea"));

    expect(response?.status).toBeGreaterThanOrEqual(300);
    expect(response?.status).toBeLessThan(400);
    expect(new URL(response!.headers.get("location")!, ORIGIN).pathname).toBe("/sign-in");
  });

  it("lets anyone with a session cookie through, whatever the page and without asking for the role", async () => {
    vi.mocked(getSessionCookie).mockReturnValue("session-token");

    for (const pathname of ["/my-tea", "/users", "/editions/2026", "/admin-dashboard"]) {
      expectPassedThrough(await proxy(request(pathname)));
    }
    expect(getSessionCookie).toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("the proxy matcher", () => {
  const runsOn = (url: string) => unstable_doesMiddlewareMatch({ config, url });

  it("runs on pages and on server action posts to them", () => {
    for (const url of ["/", "/my-tea", "/invitado", "/editions/2026"]) {
      expect(runsOn(url), url).toBe(true);
    }
  });

  it("skips the auth API, the Next assets and every file with an extension", () => {
    for (const url of [
      "/api/auth/get-session",
      "/_next/static/chunks/main.js",
      "/_next/image",
      "/favicon.ico",
      "/logo.png",
      "/icons/tea.svg",
      "/images/day.jpg",
      "/loading.gif",
      "/sounds/bell.mp3",
    ]) {
      expect(runsOn(url), url).toBe(false);
    }
  });
});

// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getGuestParticipationByToken } = vi.hoisted(() => ({ getGuestParticipationByToken: vi.fn() }));

vi.mock("@/lib/dal", () => ({ getGuestParticipationByToken }));
vi.mock("@/lib/dal/dal-participation-tea", () => ({ getGuestParticipationByToken }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

const GUEST_COOKIE = "advientea-guest";
const SIXTY_DAYS_IN_SECONDS = 60 * 24 * 60 * 60;
const ORIGIN = "https://adviente.example";

type GuestCookie = { attributes: Record<string, string>; value: string };

/** The route is loaded anew each time, so that it reads NODE_ENV as the test set it. */
async function visit(token: string) {
  vi.resetModules();
  const { GET } = await import("@/app/invitado/[token]/route");
  const request = new NextRequest(`${ORIGIN}/invitado/${token}`);
  return GET(request, { params: Promise.resolve({ token }) });
}

/** The Set-Cookie of the guest cookie, with its attributes keyed in lower case. */
function guestCookieOf(response: Response): GuestCookie {
  const header = response.headers.getSetCookie().find((cookie) => cookie.startsWith(`${GUEST_COOKIE}=`));
  expect(header, "the response sets no guest cookie").toBeDefined();
  const [pair, ...attributes] = header!.split(";").map((part) => part.trim());
  return {
    attributes: Object.fromEntries(
      attributes.map((attribute) => {
        const [key, ...rest] = attribute.split("=");
        return [key.toLowerCase(), rest.join("=")];
      }),
    ),
    value: decodeURIComponent(pair.slice(GUEST_COOKIE.length + 1)),
  };
}

function expectRedirectToGuestPage(response: Response, token: string) {
  expect(response.status).toBe(303);
  const location = new URL(response.headers.get("location")!, ORIGIN);
  expect(location.pathname).toBe("/invitado");
  expect(location.href).not.toContain(token);
}

describe("GET /invitado/[token]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getGuestParticipationByToken.mockImplementation(async (token: string) =>
      token === "valid-token" ? { guestName: "Prima Lejana", id: "guest-participation-id" } : null,
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("keeps a valid token in a cookie for the guest page only and sends the guest there, off the address bar", async () => {
    vi.stubEnv("NODE_ENV", "development");

    const response = await visit("valid-token");

    expect(getGuestParticipationByToken).toHaveBeenCalledWith("valid-token");
    expectRedirectToGuestPage(response, "valid-token");
    const cookie = guestCookieOf(response);
    expect(cookie.value).toBe("valid-token");
    expect(cookie.attributes).toHaveProperty("httponly");
    expect(cookie.attributes.samesite?.toLowerCase()).toBe("lax");
    expect(cookie.attributes.path).toBe("/invitado");
    expect(Number(cookie.attributes["max-age"])).toBe(SIXTY_DAYS_IN_SECONDS);
    expect(cookie.attributes).not.toHaveProperty("secure");
  });

  it("marks the cookie secure in production", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const response = await visit("valid-token");

    expect(guestCookieOf(response).attributes).toHaveProperty("secure");
  });

  it("sends a visitor with a token that matches no guest to the guest page and deletes the cookie they had", async () => {
    const response = await visit("stale-token");

    expectRedirectToGuestPage(response, "stale-token");
    const cookie = guestCookieOf(response);
    expect(cookie.value).toBe("");
    // A cookie is only removed by the browser when the deletion names the path it was set with.
    expect(cookie.attributes.path).toBe("/invitado");
    const expired =
      cookie.attributes["max-age"] === "0" ||
      (cookie.attributes.expires !== undefined && new Date(cookie.attributes.expires).getTime() <= Date.now());
    expect(expired, "the cookie is not expired").toBe(true);
  });

  it("is never cached and sends no referrer, whether the token is valid or not", async () => {
    for (const token of ["valid-token", "stale-token"]) {
      const response = await visit(token);

      expect(response.headers.get("cache-control")).toMatch(/no-store/);
      expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    }
  });
});

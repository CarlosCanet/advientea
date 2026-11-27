import { describe, expect, it } from "vitest";

import nextConfig from "../../next.config";

type HeaderEntry = { headers: { key: string; value: string }[]; source: string };

async function toHeaderEntries(): Promise<HeaderEntry[]> {
  const headers = nextConfig.headers;
  expect(headers, "next.config.ts must define headers()").toBeTypeOf("function");
  return (await headers!()) as HeaderEntry[];
}

function toEntryIndex(entries: HeaderEntry[], source: string): number {
  const matches = entries.filter((entry) => entry.source === source);
  expect(matches, `exactly one entry for ${source}`).toHaveLength(1);
  return entries.indexOf(matches[0]);
}

const NO_REFERRER = [{ key: "Referrer-Policy", value: "no-referrer" }];

describe("next.config.ts headers()", () => {
  it("keeps the global entry with Referrer-Policy strict-origin-when-cross-origin", async () => {
    const entries = await toHeaderEntries();
    const global = entries[toEntryIndex(entries, "/:path*")];

    expect(global.headers).toContainEqual({ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" });
  });

  it("keeps the guest link entry unchanged, after the global one", async () => {
    const entries = await toHeaderEntries();
    const globalIndex = toEntryIndex(entries, "/:path*");
    const guestIndex = toEntryIndex(entries, "/invitado/:token");

    expect(entries[guestIndex]).toEqual({ headers: NO_REFERRER, source: "/invitado/:token" });
    expect(guestIndex).toBeGreaterThan(globalIndex);
  });

  it("sends no Referer from the reset password page", async () => {
    const entries = await toHeaderEntries();
    const index = toEntryIndex(entries, "/reset-password");

    expect(entries[index]).toEqual({ headers: NO_REFERRER, source: "/reset-password" });
  });

  it("sends no Referer from the reset link", async () => {
    const entries = await toHeaderEntries();
    const index = toEntryIndex(entries, "/api/auth/reset-password/:token");

    expect(entries[index]).toEqual({ headers: NO_REFERRER, source: "/api/auth/reset-password/:token" });
  });

  it("puts both reset entries after the global and the guest entries, in that order", async () => {
    const entries = await toHeaderEntries();
    const globalIndex = toEntryIndex(entries, "/:path*");
    const guestIndex = toEntryIndex(entries, "/invitado/:token");
    const pageIndex = toEntryIndex(entries, "/reset-password");
    const linkIndex = toEntryIndex(entries, "/api/auth/reset-password/:token");

    expect(pageIndex).toBeGreaterThan(globalIndex);
    expect(linkIndex).toBeGreaterThan(globalIndex);
    expect(pageIndex).toBeGreaterThan(guestIndex);
    expect(linkIndex).toBeGreaterThan(pageIndex);
  });
});

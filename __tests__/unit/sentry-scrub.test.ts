import { describe, expect, it } from "vitest";

import { toScrubbedGuestEvent, toScrubbedGuestUrl } from "@/lib/sentry-scrub";

describe("toScrubbedGuestUrl", () => {
  it("hides the token of an absolute guest link and keeps its query and hash", () => {
    expect(toScrubbedGuestUrl("https://adviente.example/invitado/s3cr3t-T0ken_x?utm=mail#top")).toBe(
      "https://adviente.example/invitado/[token]?utm=mail#top",
    );
  });

  it("hides the token inside a relative path and a transaction name", () => {
    expect(toScrubbedGuestUrl("/invitado/s3cr3t-T0ken_x")).toBe("/invitado/[token]");
    expect(toScrubbedGuestUrl("GET /invitado/s3cr3t-T0ken_x")).toBe("GET /invitado/[token]");
  });

  it("leaves the guest page itself and every other path as they are", () => {
    for (const url of ["/invitado", "/invitado?x=1", "https://adviente.example/teaDay/day-id", "/invitadoX/abc"]) {
      expect(toScrubbedGuestUrl(url), url).toBe(url);
    }
  });
});

describe("toScrubbedGuestEvent", () => {
  it("hides the token in every string of the event, nested arrays included, and keeps the other leaves", () => {
    const event = {
      breadcrumbs: [
        { data: { status_code: 303, url: "https://adviente.example/invitado/s3cr3t?ref=1" }, level: "info" },
        { data: { url: "/my-tea" }, message: null },
      ],
      extra: { links: [["/invitado/s3cr3t", 7], [true]] },
      request: { method: "GET", url: "https://adviente.example/invitado/s3cr3t#form" },
      transaction: "GET /invitado/s3cr3t",
    };

    expect(toScrubbedGuestEvent(event)).toEqual({
      breadcrumbs: [
        { data: { status_code: 303, url: "https://adviente.example/invitado/[token]?ref=1" }, level: "info" },
        { data: { url: "/my-tea" }, message: null },
      ],
      extra: { links: [["/invitado/[token]", 7], [true]] },
      request: { method: "GET", url: "https://adviente.example/invitado/[token]#form" },
      transaction: "GET /invitado/[token]",
    });
  });
});

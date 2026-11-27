import { describe, expect, it } from "vitest";

import { toScrubbedEvent, toScrubbedUrl } from "@/lib/sentry-scrub";

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const item of Object.values(value)) {
      deepFreeze(item);
    }
    Object.freeze(value);
  }
  return value;
}

describe("toScrubbedUrl", () => {
  describe("guest link path", () => {
    it("hides the token of an absolute guest link and keeps its query and hash", () => {
      expect(toScrubbedUrl("https://adviente.example/invitado/s3cr3t-T0ken_x?utm=mail#top")).toBe(
        "https://adviente.example/invitado/[token]?utm=mail#top",
      );
    });

    it("hides the token inside a relative path and a transaction name", () => {
      expect(toScrubbedUrl("/invitado/s3cr3t-T0ken_x")).toBe("/invitado/[token]");
      expect(toScrubbedUrl("GET /invitado/s3cr3t-T0ken_x")).toBe("GET /invitado/[token]");
    });

    it("leaves the guest page itself and every other path as they are", () => {
      for (const url of ["/invitado", "/invitado?x=1", "https://adviente.example/teaDay/day-id", "/invitadoX/abc"]) {
        expect(toScrubbedUrl(url), url).toBe(url);
      }
    });

    it("leaves an already scrubbed guest link as it is", () => {
      expect(toScrubbedUrl("/invitado/[token]?utm=mail#top")).toBe("/invitado/[token]?utm=mail#top");
    });
  });

  describe("reset link path", () => {
    it("hides the token of an absolute reset link", () => {
      expect(toScrubbedUrl("https://adviente.example/api/auth/reset-password/AbC123xyz")).toBe(
        "https://adviente.example/api/auth/reset-password/[token]",
      );
    });

    it("hides the token of a relative reset link and in a transaction name", () => {
      expect(toScrubbedUrl("/api/auth/reset-password/AbC123xyz")).toBe("/api/auth/reset-password/[token]");
      expect(toScrubbedUrl("GET /api/auth/reset-password/AbC123xyz")).toBe("GET /api/auth/reset-password/[token]");
    });

    it("keeps the callbackURL and the hash that follow the token", () => {
      expect(
        toScrubbedUrl("https://adviente.example/api/auth/reset-password/AbC123xyz?callbackURL=%2Freset-password#top"),
      ).toBe("https://adviente.example/api/auth/reset-password/[token]?callbackURL=%2Freset-password#top");
      expect(toScrubbedUrl("/api/auth/reset-password/AbC123xyz#top")).toBe("/api/auth/reset-password/[token]#top");
    });

    it("leaves the bare reset path and an already scrubbed reset link as they are", () => {
      for (const url of [
        "/api/auth/reset-password",
        "https://adviente.example/api/auth/reset-password",
        "/api/auth/reset-password/[token]",
        "/api/auth/reset-password/[token]?callbackURL=%2Freset-password",
      ]) {
        expect(toScrubbedUrl(url), url).toBe(url);
      }
    });
  });

  describe("token query parameter", () => {
    it("hides a token that is the first query parameter", () => {
      expect(toScrubbedUrl("https://adviente.example/reset-password?token=AbC123xyz")).toBe(
        "https://adviente.example/reset-password?token=[token]",
      );
      expect(toScrubbedUrl("/reset-password?token=AbC123xyz")).toBe("/reset-password?token=[token]");
    });

    it("hides a token that follows another query parameter", () => {
      expect(toScrubbedUrl("/reset-password?lang=es&token=AbC123xyz")).toBe("/reset-password?lang=es&token=[token]");
    });

    it("ends the value at the next &, #, whitespace, quote, < or >", () => {
      const cases: [string, string][] = [
        ["/reset-password?token=AbC123&lang=es", "/reset-password?token=[token]&lang=es"],
        ["/reset-password?token=AbC123#form", "/reset-password?token=[token]#form"],
        ["/reset-password?token=AbC123", "/reset-password?token=[token]"],
        ["/reset-password?token=AbC123 next", "/reset-password?token=[token] next"],
        ["/reset-password?token=AbC123\tnext", "/reset-password?token=[token]\tnext"],
        ["/reset-password?token=AbC123\nnext", "/reset-password?token=[token]\nnext"],
        ['href="/reset-password?token=AbC123"', 'href="/reset-password?token=[token]"'],
        ["href='/reset-password?token=AbC123'", "href='/reset-password?token=[token]'"],
        ["<a>/reset-password?token=AbC123</a>", "<a>/reset-password?token=[token]</a>"],
        ["</reset-password?token=AbC123>", "</reset-password?token=[token]>"],
      ];
      for (const [input, expected] of cases) {
        expect(toScrubbedUrl(input), input).toBe(expected);
      }
    });

    it("hides the token inside a referer-like string", () => {
      expect(toScrubbedUrl("Referer: https://adviente.example/reset-password?token=AbC123xyz&error=x")).toBe(
        "Referer: https://adviente.example/reset-password?token=[token]&error=x",
      );
    });

    it("hides the token inside free text", () => {
      expect(
        toScrubbedUrl("Failed to load https://adviente.example/reset-password?token=AbC123xyz for the user, retrying"),
      ).toBe("Failed to load https://adviente.example/reset-password?token=[token] for the user, retrying");
    });

    it("keeps every other parameter as it is", () => {
      for (const url of [
        "/reset-password?error=INVALID_TOKEN",
        "/api/auth/reset-password?callbackURL=%2Freset-password",
        "/reset-password?callbackURL=%2Freset-password%3Ftoken",
        "/reset-password?mytoken=AbC123",
        "/reset-password?a=1&mytoken=AbC123",
        "/reset-password?token_type=reset",
        "/reset-password?a=1&token_type=reset",
      ]) {
        expect(toScrubbedUrl(url), url).toBe(url);
      }
    });

    it("keeps the other parameters around a hidden token", () => {
      expect(toScrubbedUrl("/reset-password?error=INVALID_TOKEN&token=AbC123&callbackURL=%2Fsign-in#x")).toBe(
        "/reset-password?error=INVALID_TOKEN&token=[token]&callbackURL=%2Fsign-in#x",
      );
    });

    it("leaves an empty token as it is", () => {
      for (const url of ["/reset-password?token=", "/reset-password?token=&lang=es", "/reset-password?token=#form"]) {
        expect(toScrubbedUrl(url), url).toBe(url);
      }
      expect(toScrubbedUrl("/reset-password?lang=es&token=")).toBe("/reset-password?lang=es&token=");
    });

    it("leaves an already scrubbed token as it is", () => {
      expect(toScrubbedUrl("/reset-password?token=[token]&lang=es")).toBe("/reset-password?token=[token]&lang=es");
    });
  });

  describe("bare query string", () => {
    it("hides a token at the very start of the string", () => {
      expect(toScrubbedUrl("token=AbC123xyz")).toBe("token=[token]");
      expect(toScrubbedUrl("token=AbC123xyz&x=1")).toBe("token=[token]&x=1");
    });

    it("hides a token that follows another parameter of a bare query string", () => {
      expect(toScrubbedUrl("x=1&token=AbC123xyz")).toBe("x=1&token=[token]");
    });

    it("keeps other parameters at the start as they are", () => {
      for (const text of ["mytoken=AbC123", "token_type=reset", "token_type=reset&x=1"]) {
        expect(toScrubbedUrl(text), text).toBe(text);
      }
    });

    it("leaves an empty token at the start as it is", () => {
      for (const text of ["token=", "token=&x=1", "token=#form"]) {
        expect(toScrubbedUrl(text), text).toBe(text);
      }
    });

    it("leaves an already scrubbed token at the start as it is", () => {
      expect(toScrubbedUrl("token=[token]")).toBe("token=[token]");
      expect(toScrubbedUrl("token=[token]&x=1")).toBe("token=[token]&x=1");
    });

    it("gives the same result when applied again", () => {
      const once = toScrubbedUrl("token=AbC123xyz&x=1");
      expect(toScrubbedUrl(once)).toBe(once);
    });
  });

  it("hides several secrets in one string", () => {
    expect(
      toScrubbedUrl(
        "from /invitado/guestS3cret to /api/auth/reset-password/pathS3cret?callbackURL=%2Freset-password then /reset-password?token=queryS3cret&x=1",
      ),
    ).toBe(
      "from /invitado/[token] to /api/auth/reset-password/[token]?callbackURL=%2Freset-password then /reset-password?token=[token]&x=1",
    );
    expect(toScrubbedUrl("/a?token=one /b?x=1&token=two")).toBe("/a?token=[token] /b?x=1&token=[token]");
  });

  it("gives the same result when applied again", () => {
    for (const url of [
      "https://adviente.example/invitado/s3cr3t?utm=mail#top",
      "https://adviente.example/api/auth/reset-password/AbC123?callbackURL=%2Freset-password#top",
      "/reset-password?token=AbC123&lang=es",
      "from /invitado/a to /api/auth/reset-password/b then /reset-password?token=c",
      "/reset-password?token=",
    ]) {
      const once = toScrubbedUrl(url);
      expect(toScrubbedUrl(once), url).toBe(once);
    }
  });

  it("leaves strings without secrets as they are", () => {
    for (const text of ["", "/my-tea", "https://adviente.example/teaDay/day-id?x=1#y", "nothing to see here"]) {
      expect(toScrubbedUrl(text), text).toBe(text);
    }
  });
});

describe("toScrubbedEvent", () => {
  it("hides the guest token in every string of the event, nested arrays included, and keeps the other leaves", () => {
    const event = {
      breadcrumbs: [
        { data: { status_code: 303, url: "https://adviente.example/invitado/s3cr3t?ref=1" }, level: "info" },
        { data: { url: "/my-tea" }, message: null },
      ],
      extra: { links: [["/invitado/s3cr3t", 7], [true]] },
      request: { method: "GET", url: "https://adviente.example/invitado/s3cr3t#form" },
      transaction: "GET /invitado/s3cr3t",
    };

    expect(toScrubbedEvent(event)).toEqual({
      breadcrumbs: [
        { data: { status_code: 303, url: "https://adviente.example/invitado/[token]?ref=1" }, level: "info" },
        { data: { url: "/my-tea" }, message: null },
      ],
      extra: { links: [["/invitado/[token]", 7], [true]] },
      request: { method: "GET", url: "https://adviente.example/invitado/[token]#form" },
      transaction: "GET /invitado/[token]",
    });
  });

  it("hides reset tokens in breadcrumbs, the request, its referer, span attributes and arrays", () => {
    const event = {
      breadcrumbs: [
        {
          category: "navigation",
          data: { from: "/sign-in", to: "/reset-password?token=navS3cret" },
        },
        {
          category: "fetch",
          data: {
            method: "GET",
            status_code: 302,
            url: "https://adviente.example/api/auth/reset-password/fetchS3cret?callbackURL=%2Freset-password",
          },
        },
        { message: "redirected to /reset-password?token=msgS3cret&error=x" },
      ],
      contexts: {
        trace: { data: { "http.url": "https://adviente.example/reset-password?token=traceS3cret" } },
      },
      request: {
        headers: {
          Referer: "https://adviente.example/reset-password?token=RefererS3cret",
          referer: "https://adviente.example/reset-password?token=refererS3cret",
          "user-agent": "Mozilla/5.0",
        },
        url: "https://adviente.example/api/auth/reset-password/reqS3cret?callbackURL=%2Freset-password",
      },
      spans: [
        {
          data: {
            "http.response.status_code": 200,
            "url.full": "https://adviente.example/reset-password?lang=es&token=spanS3cret",
          },
          description: "GET /api/auth/reset-password/spanPathS3cret",
        },
      ],
      tags: ["/reset-password?token=tagS3cret", 1, null],
      transaction: "GET /api/auth/reset-password/txS3cret",
    };

    expect(toScrubbedEvent(event)).toEqual({
      breadcrumbs: [
        {
          category: "navigation",
          data: { from: "/sign-in", to: "/reset-password?token=[token]" },
        },
        {
          category: "fetch",
          data: {
            method: "GET",
            status_code: 302,
            url: "https://adviente.example/api/auth/reset-password/[token]?callbackURL=%2Freset-password",
          },
        },
        { message: "redirected to /reset-password?token=[token]&error=x" },
      ],
      contexts: {
        trace: { data: { "http.url": "https://adviente.example/reset-password?token=[token]" } },
      },
      request: {
        headers: {
          Referer: "https://adviente.example/reset-password?token=[token]",
          referer: "https://adviente.example/reset-password?token=[token]",
          "user-agent": "Mozilla/5.0",
        },
        url: "https://adviente.example/api/auth/reset-password/[token]?callbackURL=%2Freset-password",
      },
      spans: [
        {
          data: {
            "http.response.status_code": 200,
            "url.full": "https://adviente.example/reset-password?lang=es&token=[token]",
          },
          description: "GET /api/auth/reset-password/[token]",
        },
      ],
      tags: ["/reset-password?token=[token]", 1, null],
      transaction: "GET /api/auth/reset-password/[token]",
    });
  });

  it("hides the token in the bare query string of the request", () => {
    const event = {
      request: {
        method: "GET",
        query_string: "token=AbC123xyz&callbackURL=%2Freset-password",
        url: "https://adviente.example/reset-password",
      },
    };

    expect(toScrubbedEvent(event)).toEqual({
      request: {
        method: "GET",
        query_string: "token=[token]&callbackURL=%2Freset-password",
        url: "https://adviente.example/reset-password",
      },
    });
  });

  it("scrubs a string, an array and a plain object given at the top level", () => {
    expect(toScrubbedEvent("/reset-password?token=AbC123")).toBe("/reset-password?token=[token]");
    expect(toScrubbedEvent(["/invitado/abc", "/api/auth/reset-password/def"])).toEqual([
      "/invitado/[token]",
      "/api/auth/reset-password/[token]",
    ]);
    expect(toScrubbedEvent({ url: "/reset-password?token=AbC123" })).toEqual({ url: "/reset-password?token=[token]" });
  });

  it("returns primitives and non-plain values untouched", () => {
    class Holder {
      url = "/reset-password?token=classS3cret";
    }
    const date = new Date("2026-12-01T00:00:00Z");
    const map = new Map([["url", "/reset-password?token=mapS3cret"]]);
    const holder = new Holder();
    const fn = () => "/reset-password?token=fnS3cret";

    for (const value of [42, true, false, null, undefined, BigInt(0), date, map, holder, fn]) {
      expect(toScrubbedEvent(value)).toBe(value);
    }
    expect(holder.url).toBe("/reset-password?token=classS3cret");
    expect(map.get("url")).toBe("/reset-password?token=mapS3cret");

    const event = { contexts: { holder }, timestamp: date };
    const scrubbed = toScrubbedEvent(event);
    expect(scrubbed.timestamp).toBe(date);
    expect(scrubbed.contexts.holder).toBe(holder);
  });

  it("does not mutate the input", () => {
    const input = {
      breadcrumbs: [{ data: { url: "/reset-password?token=AbC123" } }],
      request: {
        headers: { referer: "https://adviente.example/invitado/s3cr3t" },
        url: "/api/auth/reset-password/AbC123?callbackURL=%2Freset-password",
      },
      tags: ["/reset-password?token=AbC123"],
    };
    const snapshot = structuredClone(input);
    deepFreeze(input);

    const scrubbed = toScrubbedEvent(input);

    expect(input).toEqual(snapshot);
    expect(scrubbed).not.toBe(input);
    expect(scrubbed.request.url).toBe("/api/auth/reset-password/[token]?callbackURL=%2Freset-password");
  });

  it("gives the same result when applied again", () => {
    const event = {
      request: {
        headers: { referer: "https://adviente.example/reset-password?token=AbC123" },
        url: "/api/auth/reset-password/AbC123#x",
      },
      transaction: "GET /invitado/s3cr3t",
    };
    const once = toScrubbedEvent(event);

    expect(toScrubbedEvent(once)).toEqual(once);
  });
});

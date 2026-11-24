// @vitest-environment node
import { headers } from "next/headers";
import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RateLimitError } from "@/lib/errors";
import { assertWithinRateLimit, getClientIP } from "@/lib/services/rate-limit-service";

const { consumeRateLimit } = vi.hoisted(() => ({ consumeRateLimit: vi.fn() }));

vi.mock("@/lib/dal", () => ({ consumeRateLimit }));
vi.mock("@/lib/dal/dal-rate-limit", () => ({ consumeRateLimit }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("next/headers", () => ({ headers: vi.fn() }));

const SECRET = "unit-test-secret";
const IP = "203.0.113.7";
const TOO_MANY = "Demasiados intentos. Espera unos minutos y vuelve a intentarlo.";
const TOO_MANY_HOUR = "Demasiados intentos. Vuelve a intentarlo dentro de una hora.";

function hmac(value: string, secret = SECRET) {
  return createHmac("sha256", secret).update(value).digest("hex");
}

function requestHeaders(values: Record<string, string>) {
  vi.mocked(headers).mockResolvedValue(new Headers(values) as Awaited<ReturnType<typeof headers>>);
}

/** Answers each consumed rule in order; a rule past the list is let through. */
function rulesAnswer(...answers: boolean[]) {
  for (const answer of answers) {
    consumeRateLimit.mockResolvedValueOnce(answer);
  }
}

describe("RateLimitError", () => {
  it("is an Error named RateLimitError with the Spanish message by default", () => {
    const error = new RateLimitError();

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("RateLimitError");
    expect(error.message).toBe(TOO_MANY);
  });

  it("keeps a custom message", () => {
    const error = new RateLimitError(TOO_MANY_HOUR);

    expect(error).toBeInstanceOf(RateLimitError);
    expect(error.name).toBe("RateLimitError");
    expect(error.message).toBe(TOO_MANY_HOUR);
  });
});

describe("getClientIP", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the x-real-ip header, trimmed", async () => {
    requestHeaders({ "x-real-ip": `  ${IP}  ` });

    expect(await getClientIP()).toBe(IP);
  });

  it("returns null when the header is missing", async () => {
    requestHeaders({});

    expect(await getClientIP()).toBeNull();
  });

  it("returns null when the header is blank", async () => {
    requestHeaders({ "x-real-ip": "   " });

    expect(await getClientIP()).toBeNull();
  });

  it("does not fall back to x-forwarded-for, which the client can write", async () => {
    requestHeaders({ "x-forwarded-for": "198.51.100.1" });

    expect(await getClientIP()).toBeNull();
  });
});

describe("assertWithinRateLimit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // clearAllMocks keeps queued Once answers; a test that stops at the first refusal leaves some unconsumed.
    consumeRateLimit.mockReset();
    vi.stubEnv("BETTER_AUTH_SECRET", SECRET);
    consumeRateLimit.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("signin", () => {
    it("consumes the ip rule (10 in 900 s) and then the email rule (5 in 900 s), with hashed keys", async () => {
      await assertWithinRateLimit("signin", { email: "ana@example.com", ip: IP });

      expect(consumeRateLimit).toHaveBeenCalledTimes(2);
      expect(consumeRateLimit).toHaveBeenNthCalledWith(1, `signin:ip:${hmac(IP)}`, 10, 900);
      expect(consumeRateLimit).toHaveBeenNthCalledWith(2, `signin:email:${hmac("ana@example.com")}`, 5, 900);
    });

    it("resolves when every rule lets the attempt through", async () => {
      await expect(assertWithinRateLimit("signin", { email: "ana@example.com", ip: IP })).resolves.toBeUndefined();
    });

    it("hashes the email trimmed and in lower case, so its spelling does not open a new count", async () => {
      await assertWithinRateLimit("signin", { email: "  Ana@Example.COM ", ip: IP });

      expect(consumeRateLimit).toHaveBeenCalledWith(`signin:email:${hmac("ana@example.com")}`, 5, 900);
    });

    it("hashes with BETTER_AUTH_SECRET, so the stored key is neither the email nor the ip", async () => {
      vi.stubEnv("BETTER_AUTH_SECRET", "another-secret");

      await assertWithinRateLimit("signin", { email: "ana@example.com", ip: IP });

      expect(consumeRateLimit).toHaveBeenNthCalledWith(1, `signin:ip:${hmac(IP, "another-secret")}`, 10, 900);
      expect(consumeRateLimit).toHaveBeenNthCalledWith(
        2,
        `signin:email:${hmac("ana@example.com", "another-secret")}`,
        5,
        900,
      );
      for (const [key] of consumeRateLimit.mock.calls) {
        expect(key).not.toContain(IP);
        expect(key).not.toContain("ana@example.com");
      }
    });

    it("throws RateLimitError when the ip rule is exceeded, and stops there without consuming the email rule", async () => {
      rulesAnswer(false, true);

      const attempt = assertWithinRateLimit("signin", { email: "ana@example.com", ip: IP });

      await expect(attempt).rejects.toBeInstanceOf(RateLimitError);
      await expect(attempt).rejects.toThrow(TOO_MANY);
      expect(consumeRateLimit).toHaveBeenCalledOnce();
      expect(consumeRateLimit).toHaveBeenCalledWith(`signin:ip:${hmac(IP)}`, 10, 900);
    });

    it("throws RateLimitError with the signin message when only the email rule is exceeded", async () => {
      rulesAnswer(true, false);

      const attempt = assertWithinRateLimit("signin", { email: "ana@example.com", ip: IP });

      await expect(attempt).rejects.toBeInstanceOf(RateLimitError);
      await expect(attempt).rejects.toThrow(TOO_MANY);
      expect(consumeRateLimit).toHaveBeenCalledTimes(2);
    });

    it("throws RateLimitError when both rules would refuse, consuming only the ip rule", async () => {
      rulesAnswer(false, false);

      await expect(assertWithinRateLimit("signin", { email: "ana@example.com", ip: IP })).rejects.toBeInstanceOf(
        RateLimitError,
      );
      expect(consumeRateLimit).toHaveBeenCalledOnce();
    });

    it("refuses on the email rule alone when there is no ip", async () => {
      rulesAnswer(false);

      await expect(assertWithinRateLimit("signin", { email: "ana@example.com", ip: null })).rejects.toThrow(TOO_MANY);
      expect(consumeRateLimit).toHaveBeenCalledOnce();
    });

    it("skips the ip rule when there is no ip", async () => {
      await assertWithinRateLimit("signin", { email: "ana@example.com", ip: null });

      expect(consumeRateLimit).toHaveBeenCalledOnce();
      expect(consumeRateLimit).toHaveBeenCalledWith(`signin:email:${hmac("ana@example.com")}`, 5, 900);
    });

    it("skips the email rule when the email is missing or blank", async () => {
      await assertWithinRateLimit("signin", { ip: IP });
      await assertWithinRateLimit("signin", { email: "   ", ip: IP });
      await assertWithinRateLimit("signin", { email: "", ip: IP });

      expect(consumeRateLimit).toHaveBeenCalledTimes(3);
      for (const call of consumeRateLimit.mock.calls) {
        expect(call).toEqual([`signin:ip:${hmac(IP)}`, 10, 900]);
      }
    });

    it("consumes nothing and resolves with neither an ip nor an email", async () => {
      await expect(assertWithinRateLimit("signin", { email: " ", ip: null })).resolves.toBeUndefined();

      expect(consumeRateLimit).not.toHaveBeenCalled();
    });
  });

  describe("signup", () => {
    it("consumes only the ip rule (5 in 3600 s), even when an email is given", async () => {
      await assertWithinRateLimit("signup", { email: "ana@example.com", ip: IP });

      expect(consumeRateLimit).toHaveBeenCalledOnce();
      expect(consumeRateLimit).toHaveBeenCalledWith(`signup:ip:${hmac(IP)}`, 5, 3600);
    });

    it("throws RateLimitError with the one-hour message when the ip rule is exceeded", async () => {
      rulesAnswer(false);

      const attempt = assertWithinRateLimit("signup", { ip: IP });

      await expect(attempt).rejects.toBeInstanceOf(RateLimitError);
      await expect(attempt).rejects.toThrow(TOO_MANY_HOUR);
    });

    it("consumes nothing and resolves when there is no ip", async () => {
      await expect(assertWithinRateLimit("signup", { ip: null })).resolves.toBeUndefined();

      expect(consumeRateLimit).not.toHaveBeenCalled();
    });
  });

  describe("passwordReset", () => {
    it("consumes the ip rule (3 in 3600 s) and then the email rule (3 in 3600 s)", async () => {
      await assertWithinRateLimit("passwordReset", { email: " Ana@Example.com", ip: IP });

      expect(consumeRateLimit).toHaveBeenCalledTimes(2);
      expect(consumeRateLimit).toHaveBeenNthCalledWith(1, `passwordReset:ip:${hmac(IP)}`, 3, 3600);
      expect(consumeRateLimit).toHaveBeenNthCalledWith(2, `passwordReset:email:${hmac("ana@example.com")}`, 3, 3600);
    });

    it("throws RateLimitError with the one-hour message when the email rule is exceeded", async () => {
      rulesAnswer(true, false);

      const attempt = assertWithinRateLimit("passwordReset", { email: "ana@example.com", ip: IP });

      await expect(attempt).rejects.toBeInstanceOf(RateLimitError);
      await expect(attempt).rejects.toThrow(TOO_MANY_HOUR);
      expect(consumeRateLimit).toHaveBeenCalledTimes(2);
    });

    it("throws RateLimitError with the one-hour message when the ip rule is exceeded, without consuming the email rule", async () => {
      rulesAnswer(false, true);

      const attempt = assertWithinRateLimit("passwordReset", { email: "ana@example.com", ip: IP });

      await expect(attempt).rejects.toBeInstanceOf(RateLimitError);
      await expect(attempt).rejects.toThrow(TOO_MANY_HOUR);
      expect(consumeRateLimit).toHaveBeenCalledOnce();
      expect(consumeRateLimit).toHaveBeenCalledWith(`passwordReset:ip:${hmac(IP)}`, 3, 3600);
    });
  });

  describe("without BETTER_AUTH_SECRET", () => {
    it("fails closed with a plain Error and consumes nothing", async () => {
      vi.stubEnv("BETTER_AUTH_SECRET", undefined);

      const attempt = assertWithinRateLimit("signin", { email: "ana@example.com", ip: IP });

      await expect(attempt).rejects.toBeInstanceOf(Error);
      await expect(attempt).rejects.not.toBeInstanceOf(RateLimitError);
      expect(consumeRateLimit).not.toHaveBeenCalled();
    });

    it("treats an empty secret as unset: plain Error, nothing consumed", async () => {
      vi.stubEnv("BETTER_AUTH_SECRET", "");

      const attempt = assertWithinRateLimit("signin", { email: "ana@example.com", ip: IP });

      await expect(attempt).rejects.toBeInstanceOf(Error);
      await expect(attempt).rejects.not.toBeInstanceOf(RateLimitError);
      expect(consumeRateLimit).not.toHaveBeenCalled();
    });

    it("reads the secret on every call, so removing it later fails closed too", async () => {
      await assertWithinRateLimit("signup", { ip: IP });
      expect(consumeRateLimit).toHaveBeenCalledOnce();
      vi.stubEnv("BETTER_AUTH_SECRET", undefined);

      await expect(assertWithinRateLimit("signup", { ip: IP })).rejects.not.toBeInstanceOf(RateLimitError);
      expect(consumeRateLimit).toHaveBeenCalledOnce();
    });
  });
});

// @vitest-environment node
import { headers } from "next/headers";
import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RateLimitError } from "@/lib/errors";
import { assertWithinRateLimit, getClientIP, toRateLimitIP } from "@/lib/services/rate-limit-service";

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

describe("toRateLimitIP", () => {
  it.each([["203.0.113.7"], ["10.0.0.1"], ["0.0.0.0"], ["255.255.255.255"]])("returns the IPv4 %s unchanged", (ip) => {
    expect(toRateLimitIP(ip)).toBe(ip);
  });

  it("trims an IPv4 address", () => {
    expect(toRateLimitIP(`  ${IP}\t`)).toBe(IP);
  });

  it.each([
    ["2001:DB8::1", "2001:0db8:0000:0000::/64"],
    ["2001:db8:abcd:12:1:2:3:4", "2001:0db8:abcd:0012::/64"],
    ["2001:db8:abcd:12::ffff", "2001:0db8:abcd:0012::/64"],
    ["2001:0DB8:ABCD:0012:0000:0000:0000:0001", "2001:0db8:abcd:0012::/64"],
    ["1:2:3:4:5:6:7:8", "0001:0002:0003:0004::/64"],
    ["::1", "0000:0000:0000:0000::/64"],
    ["::", "0000:0000:0000:0000::/64"],
    ["fe80::1", "fe80:0000:0000:0000::/64"],
    ["2001:db8:1::", "2001:0db8:0001:0000::/64"],
  ])("reduces the IPv6 %s to its /64, %s", (ip, expected) => {
    expect(toRateLimitIP(ip)).toBe(expected);
  });

  it("trims an IPv6 address before reducing it", () => {
    expect(toRateLimitIP("  2001:DB8::1 \n")).toBe("2001:0db8:0000:0000::/64");
  });

  it.each([
    ["fe80::1%eth0", "fe80:0000:0000:0000::/64"],
    ["fe80::abcd:1%en0", "fe80:0000:0000:0000::/64"],
    ["  fe80::1%25  ", "fe80:0000:0000:0000::/64"],
  ])("drops the zone index of %s before reducing it", (ip, expected) => {
    expect(toRateLimitIP(ip)).toBe(expected);
  });

  it.each([["::ffff:203.0.113.7"], ["::FFFF:cb00:7107"], ["0:0:0:0:0:ffff:203.0.113.7"], ["::ffff:CB00:7107"]])(
    "turns the IPv4-mapped %s into its dotted IPv4",
    (ip) => {
      expect(toRateLimitIP(ip)).toBe("203.0.113.7");
    },
  );

  it("turns a fully written IPv4-mapped address into its dotted IPv4", () => {
    expect(toRateLimitIP("0000:0000:0000:0000:0000:ffff:0a00:0001")).toBe("10.0.0.1");
  });

  it.each([
    ["64:ff9b::1.2.3.4", "0064:ff9b:0000:0000::/64"],
    ["::1.2.3.4", "0000:0000:0000:0000::/64"],
    ["::ffff:0:1.2.3.4", "0000:0000:0000:0000::/64"],
    ["2001:db8::ffff:1.2.3.4", "2001:0db8:0000:0000::/64"],
  ])("reads %s, with an embedded dotted IPv4 that is not IPv4-mapped, as IPv6: %s", (ip, expected) => {
    expect(toRateLimitIP(ip)).toBe(expected);
  });

  it("gives every address of one /64 the same subject, and another /64 a different one", () => {
    const first = toRateLimitIP("2001:db8:abcd:12:1:2:3:4");

    expect(toRateLimitIP("2001:db8:abcd:12:ffff:ffff:ffff:ffff")).toBe(first);
    expect(toRateLimitIP("2001:db8:abcd:13:1:2:3:4")).not.toBe(first);
  });

  it.each([["not-an-ip"], ["999.1.1.1"], ["1.2.3"], ["01.2.3.4"], ["2001:db8::g"], ["1:2:3:4:5:6:7:8:9"]])(
    "returns the invalid input %s unchanged",
    (ip) => {
      expect(toRateLimitIP(ip)).toBe(ip);
    },
  );

  it("returns an invalid input trimmed", () => {
    expect(toRateLimitIP("  unknown  ")).toBe("unknown");
  });

  it("returns the empty string for an empty or blank input", () => {
    expect(toRateLimitIP("")).toBe("");
    expect(toRateLimitIP("   ")).toBe("");
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
    it("consumes the ip rule (30 in 900 s) and then the email rule (5 in 900 s), with hashed keys", async () => {
      await assertWithinRateLimit("signin", { email: "ana@example.com", ip: IP });

      expect(consumeRateLimit).toHaveBeenCalledTimes(2);
      expect(consumeRateLimit).toHaveBeenNthCalledWith(1, `signin:ip:${hmac(IP)}`, 30, 900);
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

      expect(consumeRateLimit).toHaveBeenNthCalledWith(1, `signin:ip:${hmac(IP, "another-secret")}`, 30, 900);
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
      expect(consumeRateLimit).toHaveBeenCalledWith(`signin:ip:${hmac(IP)}`, 30, 900);
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
        expect(call).toEqual([`signin:ip:${hmac(IP)}`, 30, 900]);
      }
    });

    it("consumes nothing and resolves with neither an ip nor an email", async () => {
      await expect(assertWithinRateLimit("signin", { email: " ", ip: null })).resolves.toBeUndefined();

      expect(consumeRateLimit).not.toHaveBeenCalled();
    });
  });

  describe("signup", () => {
    it("consumes only the ip rule (20 in 3600 s), even when an email is given", async () => {
      await assertWithinRateLimit("signup", { email: "ana@example.com", ip: IP });

      expect(consumeRateLimit).toHaveBeenCalledOnce();
      expect(consumeRateLimit).toHaveBeenCalledWith(`signup:ip:${hmac(IP)}`, 20, 3600);
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
    it("consumes the ip rule (10 in 3600 s) and then the email rule (3 in 3600 s)", async () => {
      await assertWithinRateLimit("passwordReset", { email: " Ana@Example.com", ip: IP });

      expect(consumeRateLimit).toHaveBeenCalledTimes(2);
      expect(consumeRateLimit).toHaveBeenNthCalledWith(1, `passwordReset:ip:${hmac(IP)}`, 10, 3600);
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
      expect(consumeRateLimit).toHaveBeenCalledWith(`passwordReset:ip:${hmac(IP)}`, 10, 3600);
    });
  });

  describe("ip subject", () => {
    it("hashes the /64 of an IPv6 address, not the address itself", async () => {
      await assertWithinRateLimit("signin", { ip: "2001:db8:abcd:12:1:2:3:4" });

      expect(consumeRateLimit).toHaveBeenCalledOnce();
      expect(consumeRateLimit).toHaveBeenCalledWith(`signin:ip:${hmac("2001:0db8:abcd:0012::/64")}`, 30, 900);
    });

    it("gives two IPv6 addresses of the same /64 the same key", async () => {
      await assertWithinRateLimit("signup", { ip: "2001:db8:abcd:12:1:2:3:4" });
      await assertWithinRateLimit("signup", { ip: "2001:DB8:ABCD:12::ffff" });

      expect(consumeRateLimit).toHaveBeenCalledTimes(2);
      const [[first], [second]] = consumeRateLimit.mock.calls;
      expect(second).toBe(first);
    });

    it("gives IPv6 addresses of different /64 different keys", async () => {
      await assertWithinRateLimit("signup", { ip: "2001:db8:abcd:12::1" });
      await assertWithinRateLimit("signup", { ip: "2001:db8:abcd:13::1" });

      const [[first], [second]] = consumeRateLimit.mock.calls;
      expect(second).not.toBe(first);
    });

    it("gives an IPv4-mapped address the key of its IPv4", async () => {
      await assertWithinRateLimit("passwordReset", { ip: `::ffff:${IP}` });
      await assertWithinRateLimit("passwordReset", { ip: "::FFFF:cb00:7107" });
      await assertWithinRateLimit("passwordReset", { ip: IP });

      expect(consumeRateLimit).toHaveBeenCalledTimes(3);
      for (const call of consumeRateLimit.mock.calls) {
        expect(call).toEqual([`passwordReset:ip:${hmac(IP)}`, 10, 3600]);
      }
    });

    it("hashes the trimmed IPv4 address", async () => {
      await assertWithinRateLimit("signup", { ip: `  ${IP} ` });

      expect(consumeRateLimit).toHaveBeenCalledWith(`signup:ip:${hmac(IP)}`, 20, 3600);
    });

    it("hashes an address without its zone index", async () => {
      await assertWithinRateLimit("signup", { ip: "fe80::1%eth0" });

      expect(consumeRateLimit).toHaveBeenCalledWith(`signup:ip:${hmac("fe80:0000:0000:0000::/64")}`, 20, 3600);
    });

    it("still counts an ip it cannot parse, under its trimmed value", async () => {
      await assertWithinRateLimit("signup", { ip: " unknown " });

      expect(consumeRateLimit).toHaveBeenCalledOnce();
      expect(consumeRateLimit).toHaveBeenCalledWith(`signup:ip:${hmac("unknown")}`, 20, 3600);
    });

    it("keeps the IPv6 address and its /64 out of the key", async () => {
      await assertWithinRateLimit("signup", { ip: "2001:db8:abcd:12::1" });

      const [[key]] = consumeRateLimit.mock.calls;
      expect(key).not.toContain("2001");
    });

    it("skips the ip rule when the ip is empty or blank", async () => {
      await assertWithinRateLimit("signup", { ip: "" });
      await assertWithinRateLimit("signup", { ip: "   " });
      await assertWithinRateLimit("signin", { email: "ana@example.com", ip: "  " });

      expect(consumeRateLimit).toHaveBeenCalledOnce();
      expect(consumeRateLimit).toHaveBeenCalledWith(`signin:email:${hmac("ana@example.com")}`, 5, 900);
    });

    it("treats a subject without an ip like one whose ip is null", async () => {
      await expect(assertWithinRateLimit("signup", {})).resolves.toBeUndefined();
      await assertWithinRateLimit("signin", { email: "ana@example.com" });

      expect(consumeRateLimit).toHaveBeenCalledOnce();
      expect(consumeRateLimit).toHaveBeenCalledWith(`signin:email:${hmac("ana@example.com")}`, 5, 900);
    });
  });

  describe("changePassword", () => {
    it("consumes only the user rule (5 in 900 s), keyed by the hashed user id", async () => {
      await assertWithinRateLimit("changePassword", { userId: "user-1" });

      expect(consumeRateLimit).toHaveBeenCalledOnce();
      expect(consumeRateLimit).toHaveBeenCalledWith(`changePassword:user:${hmac("user-1")}`, 5, 900);
    });

    it("resolves when the user rule lets the attempt through", async () => {
      await expect(assertWithinRateLimit("changePassword", { userId: "user-1" })).resolves.toBeUndefined();
    });

    it("hashes the user id trimmed", async () => {
      await assertWithinRateLimit("changePassword", { userId: "  user-1 " });

      expect(consumeRateLimit).toHaveBeenCalledWith(`changePassword:user:${hmac("user-1")}`, 5, 900);
    });

    it("keeps the user id out of the key", async () => {
      await assertWithinRateLimit("changePassword", { userId: "user-1" });

      const [[key]] = consumeRateLimit.mock.calls;
      expect(key).not.toContain("user-1");
    });

    it("ignores the ip and the email, which have no rule for this action", async () => {
      await assertWithinRateLimit("changePassword", { email: "ana@example.com", ip: IP, userId: "user-1" });

      expect(consumeRateLimit).toHaveBeenCalledOnce();
      expect(consumeRateLimit).toHaveBeenCalledWith(`changePassword:user:${hmac("user-1")}`, 5, 900);
    });

    it("throws RateLimitError with the default message when the user rule is exceeded", async () => {
      rulesAnswer(false);

      const attempt = assertWithinRateLimit("changePassword", { userId: "user-1" });

      await expect(attempt).rejects.toBeInstanceOf(RateLimitError);
      await expect(attempt).rejects.toThrow(TOO_MANY);
    });

    it("consumes nothing and resolves when the user id is missing or blank", async () => {
      await expect(assertWithinRateLimit("changePassword", {})).resolves.toBeUndefined();
      await expect(assertWithinRateLimit("changePassword", { userId: "" })).resolves.toBeUndefined();
      await expect(assertWithinRateLimit("changePassword", { ip: IP, userId: "   " })).resolves.toBeUndefined();

      expect(consumeRateLimit).not.toHaveBeenCalled();
    });

    it("gives different users different keys", async () => {
      await assertWithinRateLimit("changePassword", { userId: "user-1" });
      await assertWithinRateLimit("changePassword", { userId: "user-2" });

      const [[first], [second]] = consumeRateLimit.mock.calls;
      expect(second).not.toBe(first);
    });
  });

  describe("rules of other actions", () => {
    it("never applies the user rule to signin, signup or passwordReset, and consumes ip before email", async () => {
      await assertWithinRateLimit("signin", { email: "ana@example.com", ip: IP, userId: "user-1" });
      await assertWithinRateLimit("signup", { ip: IP, userId: "user-1" });
      await assertWithinRateLimit("passwordReset", { email: "ana@example.com", ip: IP, userId: "user-1" });

      expect(consumeRateLimit.mock.calls.map(([key]) => key)).toEqual([
        `signin:ip:${hmac(IP)}`,
        `signin:email:${hmac("ana@example.com")}`,
        `signup:ip:${hmac(IP)}`,
        `passwordReset:ip:${hmac(IP)}`,
        `passwordReset:email:${hmac("ana@example.com")}`,
      ]);
    });

    it("consumes nothing for signin with only a user id", async () => {
      await expect(assertWithinRateLimit("signin", { userId: "user-1" })).resolves.toBeUndefined();

      expect(consumeRateLimit).not.toHaveBeenCalled();
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

    it("fails closed for changePassword too, consuming nothing", async () => {
      vi.stubEnv("BETTER_AUTH_SECRET", undefined);

      const attempt = assertWithinRateLimit("changePassword", { userId: "user-1" });

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

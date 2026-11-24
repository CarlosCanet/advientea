import { headers } from "next/headers";
import { createHmac } from "node:crypto";
import { isIP } from "node:net";

import { consumeRateLimit } from "@/lib/dal";
import { RateLimitError } from "@/lib/errors";

type RateLimitAction = "changePassword" | "passwordReset" | "signin" | "signup";
interface RateLimitRule {
  max: number;
  windowSeconds: number;
}

const HOUR_WINDOW_MESSAGE = "Demasiados intentos. Vuelve a intentarlo dentro de una hora.";

const RATE_LIMITS: Record<
  RateLimitAction,
  { email?: RateLimitRule; ip?: RateLimitRule; message?: string; user?: RateLimitRule }
> = {
  changePassword: { user: { max: 5, windowSeconds: 900 } },
  passwordReset: {
    email: { max: 3, windowSeconds: 3600 },
    ip: { max: 10, windowSeconds: 3600 },
    message: HOUR_WINDOW_MESSAGE,
  },
  signin: { email: { max: 5, windowSeconds: 900 }, ip: { max: 30, windowSeconds: 900 } },
  signup: { ip: { max: 20, windowSeconds: 3600 }, message: HOUR_WINDOW_MESSAGE },
};

// An IPv6 customer normally owns a whole /64, so counting single addresses would give them a fresh budget per
// address; IPv4-mapped addresses count as the IPv4 they carry.
export function toRateLimitIP(ip: string): string {
  const trimmed = ip.trim();
  const zoneStart = trimmed.indexOf("%");
  const address = zoneStart === -1 ? trimmed : trimmed.slice(0, zoneStart);
  const version = isIP(address);
  if (version === 4) {
    return address;
  }
  if (version !== 6) {
    return trimmed;
  }
  const groups = toIPv6Groups(address);
  const isIPv4Mapped = groups.slice(0, 5).every((group) => group === "0000") && groups[5] === "ffff";
  if (isIPv4Mapped) {
    return groups
      .slice(6)
      .flatMap((group) => {
        const value = parseInt(group, 16);
        return [value >> 8, value & 0xff];
      })
      .join(".");
  }
  return `${groups.slice(0, 4).join(":")}::/64`;
}

function toIPv6Groups(address: string): string[] {
  let text = address.toLowerCase();
  const lastColon = text.lastIndexOf(":");
  const lastPart = text.slice(lastColon + 1);
  if (lastPart.includes(".")) {
    const [a, b, c, d] = lastPart.split(".").map(Number);
    text = `${text.slice(0, lastColon + 1)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const [headText, tailText] = text.split("::");
  const head = headText ? headText.split(":") : [];
  let groups = head;
  if (tailText !== undefined) {
    const tail = tailText ? tailText.split(":") : [];
    groups = [...head, ...Array<string>(8 - head.length - tail.length).fill("0"), ...tail];
  }
  return groups.map((group) => group.padStart(4, "0"));
}

export async function getClientIP(): Promise<null | string> {
  const ip = (await headers()).get("x-real-ip")?.trim();
  return ip || null;
}

export async function assertWithinRateLimit(
  action: RateLimitAction,
  subject: { email?: string; ip?: null | string; userId?: string },
): Promise<void> {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) {
    throw new Error("BETTER_AUTH_SECRET is not set: the rate limit cannot hash its keys.");
  }
  const toKey = (kind: "email" | "ip" | "user", value: string) =>
    `${action}:${kind}:${createHmac("sha256", secret).update(value).digest("hex")}`;

  const rules = RATE_LIMITS[action];
  const ip = subject.ip ? toRateLimitIP(subject.ip) : "";
  const email = subject.email?.trim().toLowerCase();
  const userId = subject.userId?.trim();
  const checks: Array<{ key: string; rule: RateLimitRule }> = [];
  if (rules.ip && ip) {
    checks.push({ key: toKey("ip", ip), rule: rules.ip });
  }
  if (rules.email && email) {
    checks.push({ key: toKey("email", email), rule: rules.email });
  }
  if (rules.user && userId) {
    checks.push({ key: toKey("user", userId), rule: rules.user });
  }

  // Stop at the first refusal: a refused attempt never reaches better-auth, so counting it against the other
  // rules protects nothing and would let one IP spend every account's email budget.
  for (const { key, rule } of checks) {
    if (!(await consumeRateLimit(key, rule.max, rule.windowSeconds))) {
      throw new RateLimitError(rules.message);
    }
  }
}

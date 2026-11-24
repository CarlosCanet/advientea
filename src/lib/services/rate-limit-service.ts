import { headers } from "next/headers";
import { createHmac } from "node:crypto";

import { consumeRateLimit } from "@/lib/dal";
import { RateLimitError } from "@/lib/errors";

type RateLimitAction = "passwordReset" | "signin" | "signup";
interface RateLimitRule {
  max: number;
  windowSeconds: number;
}

const HOUR_WINDOW_MESSAGE = "Demasiados intentos. Vuelve a intentarlo dentro de una hora.";

const RATE_LIMITS: Record<RateLimitAction, { email?: RateLimitRule; ip: RateLimitRule; message?: string }> = {
  passwordReset: {
    email: { max: 3, windowSeconds: 3600 },
    ip: { max: 3, windowSeconds: 3600 },
    message: HOUR_WINDOW_MESSAGE,
  },
  signin: { email: { max: 5, windowSeconds: 900 }, ip: { max: 10, windowSeconds: 900 } },
  signup: { ip: { max: 5, windowSeconds: 3600 }, message: HOUR_WINDOW_MESSAGE },
};

export async function getClientIP(): Promise<null | string> {
  const ip = (await headers()).get("x-real-ip")?.trim();
  return ip || null;
}

export async function assertWithinRateLimit(
  action: RateLimitAction,
  subject: { email?: string; ip: null | string },
): Promise<void> {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) {
    throw new Error("BETTER_AUTH_SECRET is not set: the rate limit cannot hash its keys.");
  }
  const toKey = (kind: "email" | "ip", value: string) =>
    `${action}:${kind}:${createHmac("sha256", secret).update(value).digest("hex")}`;

  const rules = RATE_LIMITS[action];
  const email = subject.email?.trim().toLowerCase();
  const checks: Array<{ key: string; rule: RateLimitRule }> = [];
  if (subject.ip) {
    checks.push({ key: toKey("ip", subject.ip), rule: rules.ip });
  }
  if (rules.email && email) {
    checks.push({ key: toKey("email", email), rule: rules.email });
  }

  // Stop at the first refusal: a refused attempt never reaches better-auth, so counting it against the other
  // rules protects nothing and would let one IP spend every account's email budget.
  for (const { key, rule } of checks) {
    if (!(await consumeRateLimit(key, rule.max, rule.windowSeconds))) {
      throw new RateLimitError(rules.message);
    }
  }
}

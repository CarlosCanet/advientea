import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { consumeRateLimit as appConsumeRateLimit } from "@/lib/dal/dal-rate-limit";
import type { prisma as appPrisma } from "@/lib/prisma";

const { ZONE } = vi.hoisted(() => ({
  // UTC+14, the furthest offset from the UTC the test database runs in: a window read in local time shifts by 14 h.
  ZONE: "Pacific/Kiritimati",
}));

// Every connection of this client starts with the session TimeZone set to ZONE.
vi.mock("@/lib/prisma", async () => {
  await import("@/envConfig");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const { PrismaClient } = await import("@/generated/prisma/client");
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: 2, options: `-c TimeZone=${ZONE}` });
  return { prisma: new PrismaClient({ adapter }) };
});

const KEY = "signin:ip:timezone-key";
const WINDOW = 900;
const HOUR = 3600;

let prisma: typeof appPrisma;
let consumeRateLimit: typeof appConsumeRateLimit;

beforeAll(async () => {
  // The setup file already loaded the DAL with the default client; load it again so it binds to the one above.
  vi.resetModules();
  ({ prisma } = await import("@/lib/prisma"));
  ({ consumeRateLimit } = await import("@/lib/dal/dal-rate-limit"));
});

afterAll(async () => {
  await prisma.$disconnect();
});

/** Seconds between the database's now and the start of the window of `key`, measured inside Postgres. */
async function windowAge(key: string): Promise<number> {
  const [{ age }] = await prisma.$queryRaw<{ age: number }[]>`
    SELECT extract(epoch FROM now() - "windowStart")::float8 AS age FROM "RateLimit" WHERE key = ${key}
  `;
  return age;
}

/** Writes a row whose window started `seconds` before the database's now, computed by Postgres, not by the driver. */
async function seedRow(key: string, seconds: number, count = 1) {
  await prisma.$executeRaw`
    INSERT INTO "RateLimit" (key, count, "windowStart")
    VALUES (${key}, ${count}::int, now() - ${seconds}::int * interval '1 second')
  `;
}

async function setWindowAge(key: string, seconds: number) {
  await prisma.$executeRaw`
    UPDATE "RateLimit" SET "windowStart" = now() - ${seconds}::int * interval '1 second' WHERE key = ${key}
  `;
}

async function countOf(key: string): Promise<number> {
  return (await prisma.rateLimit.findUniqueOrThrow({ select: { count: true }, where: { key } })).count;
}

async function storedKeys(): Promise<string[]> {
  const rows = await prisma.rateLimit.findMany({ select: { key: true } });
  return rows.map(({ key }) => key).sort();
}

async function attempts(key: string, times: number, max: number): Promise<boolean[]> {
  const results: boolean[] = [];
  for (let i = 0; i < times; i++) {
    results.push(await consumeRateLimit(key, max, WINDOW));
  }
  return results;
}

describe(`dal RateLimit with the session TimeZone set to ${ZONE}`, () => {
  it("runs on a session whose TimeZone is not UTC", async () => {
    const [{ zone }] = await prisma.$queryRaw<{ zone: string }[]>`SELECT current_setting('TimeZone') AS zone`;

    expect(zone).toBe(ZONE);
  });

  it("opens a window that starts now", async () => {
    expect(await consumeRateLimit(KEY, 5, WINDOW)).toBe(true);

    const age = await windowAge(KEY);
    expect(age).toBeGreaterThanOrEqual(0);
    expect(age).toBeLessThan(5);
  });

  it("keeps counting inside the window and refuses past max", async () => {
    expect(await attempts(KEY, 6, 5)).toEqual([true, true, true, true, true, false]);
    expect(await countOf(KEY)).toBe(6);
  });

  it("still refuses an exhausted key shortly before its window ends", async () => {
    await attempts(KEY, 5, 5);
    await setWindowAge(KEY, WINDOW - 60);

    expect(await consumeRateLimit(KEY, 5, WINDOW)).toBe(false);
    expect(await countOf(KEY)).toBe(6);
  });

  it("starts a new window once the old one is over", async () => {
    await attempts(KEY, 6, 5);
    await setWindowAge(KEY, WINDOW + 1);

    expect(await consumeRateLimit(KEY, 5, WINDOW)).toBe(true);
    expect(await countOf(KEY)).toBe(1);
    expect(await windowAge(KEY)).toBeLessThan(5);
  });

  it("prunes the rows older than 24 hours and keeps the recent ones", async () => {
    await seedRow("signin:ip:stale-25h", 25 * HOUR);
    await seedRow("signup:ip:stale-24h1m", 24 * HOUR + 60);
    await seedRow("passwordReset:email:recent-23h", 23 * HOUR);
    await seedRow("signin:email:recent-10h", 10 * HOUR);

    expect(await consumeRateLimit(KEY, 5, WINDOW)).toBe(true);

    expect(await storedKeys()).toEqual([KEY, "passwordReset:email:recent-23h", "signin:email:recent-10h"].sort());
  });
});

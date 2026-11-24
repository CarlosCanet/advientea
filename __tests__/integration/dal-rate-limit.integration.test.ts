import { afterEach, describe, expect, it, vi } from "vitest";

import { consumeRateLimit } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

const KEY = "signin:ip:test-key";
const WINDOW = 900;
const HOUR = 3600;

/** The database clock: the window is measured against it, never against the test process. */
async function databaseNow(): Promise<Date> {
  const [{ now }] = await prisma.$queryRaw<{ now: Date }[]>`SELECT now() AS now`;
  return now;
}

async function rowOf(key: string) {
  return prisma.rateLimit.findUniqueOrThrow({ where: { key } });
}

/** Moves the window of `key` back by `seconds`, counted from the start the row holds, as if that time had passed. */
async function ageWindow(key: string, seconds: number) {
  const { windowStart } = await rowOf(key);
  await prisma.rateLimit.update({
    data: { windowStart: new Date(windowStart.getTime() - seconds * 1000) },
    where: { key },
  });
}

/** Sets the start of the window of `key` to `seconds` before the database's now, whatever it held. */
async function setWindowAge(key: string, seconds: number) {
  const now = await databaseNow();
  await prisma.rateLimit.update({
    data: { windowStart: new Date(now.getTime() - seconds * 1000) },
    where: { key },
  });
}

/** Writes a row straight into the table, its window started `seconds` before the database's now. */
async function seedRow(key: string, seconds: number, count = 1) {
  const now = await databaseNow();
  await prisma.rateLimit.create({ data: { count, key, windowStart: new Date(now.getTime() - seconds * 1000) } });
}

/** Every stored key, sorted in JavaScript so the database collation does not decide the order. */
async function storedKeys(): Promise<string[]> {
  const rows = await prisma.rateLimit.findMany({ select: { key: true } });
  return rows.map(({ key }) => key).sort();
}

async function attempts(key: string, times: number, max: number, windowSeconds = WINDOW): Promise<boolean[]> {
  const results: boolean[] = [];
  for (let i = 0; i < times; i++) {
    results.push(await consumeRateLimit(key, max, windowSeconds));
  }
  return results;
}

function expectCloseTo(actual: Date, expected: Date, toleranceMs = 5000) {
  expect(Math.abs(actual.getTime() - expected.getTime())).toBeLessThanOrEqual(toleranceMs);
}

describe("dal RateLimit", () => {
  describe("table", () => {
    it("stores windowStart as timestamp with time zone, so the window does not depend on the session TimeZone", async () => {
      const columns = await prisma.$queryRaw<{ data_type: string }[]>`
        SELECT data_type
        FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'RateLimit' AND column_name = 'windowStart'
      `;

      expect(columns).toEqual([{ data_type: "timestamp with time zone" }]);
    });

    it("has an index led by windowStart, for the pruning of old rows", async () => {
      const indexes = await prisma.$queryRaw<{ name: string }[]>`
        SELECT index_class.relname AS name
        FROM pg_index
        JOIN pg_class table_class ON table_class.oid = pg_index.indrelid
        JOIN pg_namespace ON pg_namespace.oid = table_class.relnamespace
        JOIN pg_class index_class ON index_class.oid = pg_index.indexrelid
        JOIN pg_attribute ON pg_attribute.attrelid = table_class.oid AND pg_attribute.attnum = pg_index.indkey[0]
        WHERE pg_namespace.nspname = current_schema()
          AND table_class.relname = 'RateLimit'
          AND pg_attribute.attname = 'windowStart'
      `;

      expect(indexes.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("consumeRateLimit", () => {
    it("lets the first attempt through and opens a window that starts now with one attempt", async () => {
      const allowed = await consumeRateLimit(KEY, 5, WINDOW);

      const row = await rowOf(KEY);
      expect(allowed).toBe(true);
      expect(row.count).toBe(1);
      expectCloseTo(row.windowStart, await databaseNow());
    });

    it("lets through up to max attempts in the window, counting the current one, and refuses the next", async () => {
      expect(await attempts(KEY, 4, 3)).toEqual([true, true, true, false]);
    });

    it("keeps counting the attempts over the limit", async () => {
      const results = await attempts(KEY, 7, 5);

      expect(results).toEqual([true, true, true, true, true, false, false]);
      expect((await rowOf(KEY)).count).toBe(7);
    });

    it("keeps the start of the window while attempts land inside it", async () => {
      await consumeRateLimit(KEY, 5, WINDOW);
      const { windowStart } = await rowOf(KEY);

      await attempts(KEY, 3, 5);

      const row = await rowOf(KEY);
      expect(row.count).toBe(4);
      expect(row.windowStart).toEqual(windowStart);
    });

    it("still refuses an exhausted key shortly before its window ends", async () => {
      await attempts(KEY, 5, 5);
      await ageWindow(KEY, WINDOW - 60);

      expect(await consumeRateLimit(KEY, 5, WINDOW)).toBe(false);
      expect((await rowOf(KEY)).count).toBe(6);
    });

    it("starts a new window once the old one is over, with this attempt as its first", async () => {
      await attempts(KEY, 8, 5);
      await ageWindow(KEY, WINDOW + 1);

      const allowed = await consumeRateLimit(KEY, 5, WINDOW);

      const row = await rowOf(KEY);
      expect(allowed).toBe(true);
      expect(row.count).toBe(1);
      expectCloseTo(row.windowStart, await databaseNow());
    });

    it("keeps the window one second before windowSeconds have passed", async () => {
      await attempts(KEY, 5, 5);
      await setWindowAge(KEY, WINDOW - 1);
      const { windowStart } = await rowOf(KEY);

      expect(await consumeRateLimit(KEY, 5, WINDOW)).toBe(false);
      const row = await rowOf(KEY);
      expect(row.count).toBe(6);
      expect(row.windowStart).toEqual(windowStart);
    });

    it("starts a new window one second after windowSeconds have passed", async () => {
      await attempts(KEY, 5, 5);
      await setWindowAge(KEY, WINDOW + 1);

      expect(await consumeRateLimit(KEY, 5, WINDOW)).toBe(true);
      const row = await rowOf(KEY);
      expect(row.count).toBe(1);
      expectCloseTo(row.windowStart, await databaseNow());
    });

    it("counts normally again in the new window, up to max", async () => {
      await attempts(KEY, 6, 3, 3600);
      await ageWindow(KEY, 3600 + 1);

      expect(await attempts(KEY, 4, 3, 3600)).toEqual([true, true, true, false]);
      expect((await rowOf(KEY)).count).toBe(4);
    });

    it("measures the window with the windowSeconds of the call", async () => {
      await attempts(KEY, 3, 3, 3600);
      await ageWindow(KEY, 1000);

      // 1000 seconds is past a 900-second window but inside a 3600-second one.
      expect(await consumeRateLimit(KEY, 3, 3600)).toBe(false);
      expect(await consumeRateLimit(KEY, 3, 900)).toBe(true);
      expect((await rowOf(KEY)).count).toBe(1);
    });

    it("keeps every key on its own", async () => {
      await attempts("signin:ip:a", 6, 5);

      expect(await consumeRateLimit("signin:ip:b", 5, WINDOW)).toBe(true);
      expect(await consumeRateLimit("signin:email:a", 5, WINDOW)).toBe(true);
      expect((await rowOf("signin:ip:a")).count).toBe(6);
      expect((await rowOf("signin:ip:b")).count).toBe(1);
      expect((await rowOf("signin:email:a")).count).toBe(1);
    });

    it("stores the key exactly as given, in one row", async () => {
      const key = "passwordReset:email:AbC 123/ü";

      await attempts(key, 2, 5);

      const rows = await prisma.rateLimit.findMany();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ count: 2, key });
    });

    it("lets exactly max of many concurrent first attempts through and counts them all", async () => {
      const results = await Promise.all(Array.from({ length: 12 }, () => consumeRateLimit(KEY, 5, WINDOW)));

      expect(results.filter(Boolean)).toHaveLength(5);
      expect((await rowOf(KEY)).count).toBe(12);
      expect(await prisma.rateLimit.count()).toBe(1);
    });

    it("lets exactly max of many concurrent attempts through on a key already counting", async () => {
      await attempts(KEY, 2, 5);

      const results = await Promise.all(Array.from({ length: 10 }, () => consumeRateLimit(KEY, 5, WINDOW)));

      expect(results.filter(Boolean)).toHaveLength(3);
      expect((await rowOf(KEY)).count).toBe(12);
    });

    it("lets exactly max of many concurrent attempts through when they open a new window together", async () => {
      await attempts(KEY, 9, 5);
      await ageWindow(KEY, WINDOW + 1);

      const results = await Promise.all(Array.from({ length: 10 }, () => consumeRateLimit(KEY, 5, WINDOW)));

      expect(results.filter(Boolean)).toHaveLength(5);
      expect((await rowOf(KEY)).count).toBe(10);
    });
  });

  describe("pruning of old rows", () => {
    const STALE = ["signin:ip:stale-25h", "signup:ip:stale-24h1m"];
    const RECENT = ["passwordReset:email:recent-23h", "signin:email:recent-23h59m"];

    /** Two rows whose window started more than 24 hours ago and two that started less than 24 hours ago. */
    async function seedOldAndRecentRows() {
      await seedRow(STALE[0], 25 * HOUR, 7);
      await seedRow(STALE[1], 24 * HOUR + 60, 2);
      await seedRow(RECENT[0], 23 * HOUR, 3);
      await seedRow(RECENT[1], 24 * HOUR - 60, 4);
    }

    /** Makes every DELETE on the table fail, until the afterEach below drops the trigger again. */
    async function refuseEveryDelete() {
      await prisma.$executeRawUnsafe(`
        CREATE FUNCTION rate_limit_test_refuse_delete() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
          RAISE EXCEPTION 'delete refused by the test';
        END;
        $$
      `);
      await prisma.$executeRawUnsafe(`
        CREATE TRIGGER rate_limit_test_refuse_delete BEFORE DELETE ON "RateLimit"
        FOR EACH STATEMENT EXECUTE FUNCTION rate_limit_test_refuse_delete()
      `);
    }

    afterEach(async () => {
      await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS rate_limit_test_refuse_delete ON "RateLimit"`);
      await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS rate_limit_test_refuse_delete()`);
      vi.restoreAllMocks();
    });

    it("deletes the rows older than 24 hours when a new key opens its window, and keeps the recent ones", async () => {
      await seedOldAndRecentRows();

      expect(await consumeRateLimit(KEY, 5, WINDOW)).toBe(true);

      expect(await storedKeys()).toEqual([KEY, ...RECENT].sort());
      expect((await rowOf(RECENT[0])).count).toBe(3);
      expect((await rowOf(RECENT[1])).count).toBe(4);
      expect((await rowOf(KEY)).count).toBe(1);
    });

    it("deletes the rows older than 24 hours when an expired window restarts", async () => {
      await attempts(KEY, 6, 5);
      await setWindowAge(KEY, WINDOW + 1);
      await seedOldAndRecentRows();

      expect(await consumeRateLimit(KEY, 5, WINDOW)).toBe(true);

      expect(await storedKeys()).toEqual([KEY, ...RECENT].sort());
      expect((await rowOf(KEY)).count).toBe(1);
    });

    it("deletes nothing while an attempt lands inside an open window", async () => {
      await consumeRateLimit(KEY, 5, WINDOW);
      await seedOldAndRecentRows();

      expect(await consumeRateLimit(KEY, 5, WINDOW)).toBe(true);
      expect(await consumeRateLimit(KEY, 5, WINDOW)).toBe(true);

      expect(await storedKeys()).toEqual([KEY, ...STALE, ...RECENT].sort());
      expect((await rowOf(KEY)).count).toBe(3);
    });

    it("deletes nothing on an over-limit attempt inside an open window", async () => {
      await attempts(KEY, 5, 5);
      await seedOldAndRecentRows();

      expect(await consumeRateLimit(KEY, 5, WINDOW)).toBe(false);

      expect(await storedKeys()).toEqual([KEY, ...STALE, ...RECENT].sort());
    });

    it("still records the attempt and answers when the delete fails, and logs the failure", async () => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      await seedOldAndRecentRows();
      await refuseEveryDelete();

      await expect(consumeRateLimit(KEY, 5, WINDOW)).resolves.toBe(true);

      const row = await rowOf(KEY);
      expect(row.count).toBe(1);
      expectCloseTo(row.windowStart, await databaseNow());
      expect(await storedKeys()).toEqual([KEY, ...STALE, ...RECENT].sort());
      expect(consoleError).toHaveBeenCalled();
    });
  });
});

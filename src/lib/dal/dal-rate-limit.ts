import { prisma } from "@/lib/prisma";

export async function consumeRateLimit(key: string, max: number, windowSeconds: number): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ count: number }>>`
    INSERT INTO "RateLimit" ("key", "count", "windowStart")
    VALUES (${key}, 1, now())
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "RateLimit"."windowStart" <= now() - make_interval(secs => ${windowSeconds}) THEN 1
        ELSE "RateLimit"."count" + 1
      END,
      "windowStart" = CASE
        WHEN "RateLimit"."windowStart" <= now() - make_interval(secs => ${windowSeconds}) THEN now()
        ELSE "RateLimit"."windowStart"
      END
    RETURNING "count"
  `;
  const count = rows[0].count;
  // Pruning only when a window opens keeps the table bounded without a cron and spares the hot increments.
  if (count === 1) {
    try {
      await prisma.$executeRaw`DELETE FROM "RateLimit" WHERE "windowStart" < now() - interval '24 hours'`;
    } catch (error) {
      // A failed cleanup only leaves stale rows behind; the attempt has already been counted.
      console.error("[consumeRateLimit] stale row cleanup failed", error);
    }
  }
  return count <= max;
}

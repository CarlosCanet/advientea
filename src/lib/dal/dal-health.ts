import { prisma } from "@/lib/prisma";

const PING_TIMEOUT_MS = 5_000;

/**
 * Whether the database answers a trivial query within PING_TIMEOUT_MS. Never throws: a failure or a
 * timeout is logged and reported as false.
 */
export async function pingDatabase(): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  // Prisma cannot cancel a query, so the race only stops waiting for it: a hung connection is left to the
  // pool, and the request still ends on time.
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`Database ping timed out after ${PING_TIMEOUT_MS} ms`));
    }, PING_TIMEOUT_MS);
  });
  try {
    await Promise.race([prisma.$queryRaw`SELECT 1`, timeout]);
    return true;
  } catch (error) {
    console.error("Database ping failed:", error);
    return false;
  } finally {
    clearTimeout(timer);
  }
}

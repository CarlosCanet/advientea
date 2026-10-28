import "@/envConfig";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";
import { assertPreviewDatabaseIsNotProduction } from "@/lib/database-guard";

// Same guard as prisma.config.ts, for the runtime: a preview never connects to production.
assertPreviewDatabaseIsNotProduction({
  databaseUrl: process.env.DATABASE_URL,
  productionDbHost: process.env.PRODUCTION_DB_HOST,
  vercelEnv: process.env.VERCEL_ENV,
});

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
    // Serverless scales out, so every instance keeps a small pool and Neon's pooler multiplexes
    // them (pg defaults to 10 per pool).
    max: 5,
  });
  return new PrismaClient({ adapter });
}

// One client per process. Next.js dev re-evaluates modules on every edit, and a production bundle
// can evaluate this module once per route layer; the globalThis cache covers both.
export const prisma = (globalForPrisma.prisma ??= createPrismaClient());

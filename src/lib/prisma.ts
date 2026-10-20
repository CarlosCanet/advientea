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

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

export const prisma = new PrismaClient({ adapter });

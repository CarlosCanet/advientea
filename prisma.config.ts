import "./src/envConfig";
import { defineConfig, env } from "prisma/config";

import { assertPreviewDatabaseIsNotProduction } from "./src/lib/database-guard";

// Migrations need a direct connection (Neon's pooler cannot run them), so the CLI prefers the
// unpooled URL when the host provides one. Local, CI and tests only have DATABASE_URL.
const url = process.env.DATABASE_URL_UNPOOLED ?? env("DATABASE_URL");

// Runs on every Prisma CLI call, `prisma generate` at install time included, so a preview that
// fell back to the production database fails before anything touches it.
assertPreviewDatabaseIsNotProduction({
  databaseUrl: url,
  productionDbHost: process.env.PRODUCTION_DB_HOST,
  vercelEnv: process.env.VERCEL_ENV,
});

export default defineConfig({
  datasource: {
    url,
  },
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  schema: "prisma/schema.prisma",
});

import { hostnameOf, normaliseNeonHost } from "@/lib/database-guard";
import { prisma } from "@/lib/prisma";

import { seedDatabase } from "./seed-data";

// Entry point of `prisma db seed` (configured in prisma.config.ts). The seed creates sign-in
// accounts with a committed password, so it fails closed: only a local database is accepted unless
// SEED_ALLOW_REMOTE=1 is set on purpose (a disposable Neon branch), and production never is.
const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost"]);
const host = hostnameOf(process.env.DATABASE_URL ?? "");
const productionHost = process.env.PRODUCTION_DB_HOST?.trim();
if (!host) throw new Error("DATABASE_URL has no recognisable hostname.");
if (
  process.env.VERCEL_ENV === "production" ||
  process.env.NODE_ENV === "production" ||
  (productionHost && normaliseNeonHost(host) === normaliseNeonHost(productionHost))
) {
  throw new Error("Refusing to seed a production database.");
}
if (!LOCAL_HOSTS.has(host.toLowerCase()) && process.env.SEED_ALLOW_REMOTE !== "1") {
  throw new Error(`Refusing to seed the remote database at ${host}. Set SEED_ALLOW_REMOTE=1 for a disposable branch.`);
}

seedDatabase()
  .then(() => console.log("Seed done"))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

import { execSync } from "node:child_process";

export async function setup() {
  // 1. Mounting container
  console.log("\n🐳 [Global Setup] Setting up test environment...");
  try {
    execSync("docker compose up -d", { stdio: "ignore" });
  } catch (e) {
    console.error("❌ Error mounting docker container. Is Docker Desktop running?");
    throw e;
  }

  // 2. Waiting for Postgres
  console.log("⏳ [Global Setup] Waiting for DB...");  
  const maxRetries = 10;
  let retries = 0;
  let ready = false;

  while (retries < maxRetries && !ready) {
    try {
      execSync("docker exec integration-tests pg_isready -U postgres", { stdio: "ignore" });
      ready = true;
    } catch (e) {
      retries++;
      await new Promise((r) => setTimeout(r, 5000));
    }
  }

  if (!ready) {
    throw new Error("❌ Timeout: DB not running.");
  }

  // 3. Migrating prisma schema
  console.log("🚀 [Global Setup] Running migrations...");
  try {
    execSync("pnpm dotenv -e .env.test -- prisma migrate deploy", { stdio: "inherit" });
  } catch (e) {
    console.error("❌ Error running migrations.");
    throw e;
  }

  console.log("✅ [Global Setup] Setup done. Running tests...\n");
}

export async function teardown() {
  console.log("\n🧹 [Global Teardown] Cleaning...");
  // execSync("docker compose down", { stdio: "ignore" });
}
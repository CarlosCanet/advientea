import { execSync } from "node:child_process";

// The container, the migrations and the tests must agree on the port: all read .env.test.local first.
const WITH_TEST_ENV = "pnpm dotenv -e .env.test.local -e .env.test --";

export async function setup() {
  console.log("\n🐳 [Global Setup] Setting up test environment...");
  try {
    execSync(`${WITH_TEST_ENV} docker compose up -d --wait db-test`, { stdio: "inherit" });
  } catch (e) {
    console.error("❌ Error starting the test database. Is Docker running?");
    throw e;
  }

  console.log("🚀 [Global Setup] Running migrations...");
  try {
    execSync(`${WITH_TEST_ENV} prisma migrate deploy`, { stdio: "inherit" });
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

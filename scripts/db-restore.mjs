// Restores a pg_dump custom-format file into the compose `db` service only, so it can never reach a
// remote database. The database is recreated first: `--clean` would leave objects the dump lacks.
import { spawnSync } from "node:child_process";
import { openSync } from "node:fs";
import { join } from "node:path";

const DATABASE = "advientea";
// Pinned so COMPOSE_FILE, COMPOSE_PROJECT_NAME or the cwd cannot point this at another project.
const COMPOSE = ["compose", "-f", join(import.meta.dirname, "..", "docker-compose.yml"), "-p", "advientea"];

const [file] = process.argv.slice(2);
if (!file) {
  console.error("Usage: pnpm db:restore <dump-file>");
  process.exit(1);
}

let fd;
try {
  fd = openSync(file, "r");
} catch {
  console.error(`[db-restore] cannot read ${file}`);
  process.exit(1);
}

function run(args, { stdin = "inherit" } = {}) {
  const result = spawnSync("docker", [...COMPOSE, ...args], { stdio: [stdin, "inherit", "inherit"] });
  if (result.error) console.error(`[db-restore] cannot run docker: ${result.error.message}`);
  return result.status ?? 1;
}

const inDb = (...command) => ["exec", "-T", "db", ...command];

console.log("[db-restore] starting the dev database");
if (run(["up", "-d", "--wait", "db"]) !== 0) process.exit(1);

console.log(`[db-restore] recreating the ${DATABASE} database`);
// --force closes open connections (a running `pnpm dev`, Prisma Studio) instead of failing.
if (run(inDb("dropdb", "-U", "postgres", "--force", "--if-exists", DATABASE)) !== 0) process.exit(1);
if (run(inDb("createdb", "-U", "postgres", DATABASE)) !== 0) process.exit(1);

console.log(`[db-restore] restoring ${file}`);
const restore = inDb("pg_restore", "-U", "postgres", "-d", DATABASE, "--no-owner", "--no-privileges");
const status = run(restore, { stdin: fd });
if (status !== 0) {
  // pg_restore exits 1 after any ignored error, benign ones included; the data is usually complete.
  console.error("[db-restore] pg_restore finished but reported errors; review the output above");
  process.exit(status);
}
console.log("[db-restore] done. Check pending migrations with: pnpm exec prisma migrate status");

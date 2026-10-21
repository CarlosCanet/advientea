// Database step of the Vercel build (`pnpm build`).
//
// - preview:    apply pending migrations to the deployment's own Neon branch.
// - production: never migrate from the build. Only check: if migrations are pending the build
//               fails, so production is migrated on purpose, through the "Migrate production"
//               GitHub workflow, before the code that needs the new schema goes live.
// - anything else (local builds, CI): skip, so a build never touches a database by accident.
import { spawnSync } from "node:child_process";

const env = process.env.VERCEL_ENV;

function prisma(args, { capture = false } = {}) {
  const result = spawnSync("pnpm", ["exec", "prisma", ...args], {
    encoding: "utf8",
    shell: true,
    stdio: capture ? "pipe" : "inherit",
  });
  return { output: `${result.stdout ?? ""}${result.stderr ?? ""}`, status: result.status ?? 1 };
}

if (env === "preview") {
  console.log("[vercel-migrate] preview: applying migrations to the preview database");
  process.exit(prisma(["migrate", "deploy"]).status);
}

if (env === "production") {
  console.log("[vercel-migrate] production: checking migration status, nothing is applied here");
  const { output, status } = prisma(["migrate", "status"], { capture: true });
  process.stdout.write(output);
  // Prisma 7 exits 1 with pending migrations and prints "Database schema is up to date!" when
  // clean; the Prisma 8 CLI exits 0 either way and summarises "Up to date". Requiring a zero
  // exit, the exact clean sentence on its own line and no pending marker keeps the check
  // fail-closed across the upgrade.
  const lines = output.split(/\r?\n/).map((line) => line.trim());
  const clean = lines.some((line) => line === "Database schema is up to date!" || line === "Up to date");
  const pending = /not yet been applied|pending/i.test(output);
  const upToDate = status === 0 && clean && !pending;
  if (!upToDate) {
    console.error(
      "[vercel-migrate] production is not up to date with prisma/migrations. Run the 'Migrate " +
        "production' workflow in GitHub Actions (it needs your approval), then redeploy. " +
        "The build stops here on purpose.",
    );
    process.exit(1);
  }
  process.exit(0);
}

console.log(`[vercel-migrate] VERCEL_ENV=${env ?? "(unset)"}: skipping database step`);

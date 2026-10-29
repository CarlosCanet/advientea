/**
 * Build- and run-time guard for Vercel previews.
 *
 * Neon injects a branch database into every preview deployment, but the project-level
 * DATABASE_URL (scoped to Production and Preview) is the fallback when that injection does not
 * happen, and it points at production. A preview must never install, migrate, build or run
 * against it, so in the preview environment the database host is compared with the production
 * host and anything that matches is refused. Outside previews this is a no-op.
 */

export interface DatabaseGuardInput {
  databaseUrl: string | undefined;
  /** Hostname of the production database, pooled or direct form; set as PRODUCTION_DB_HOST. */
  productionDbHost: string | undefined;
  vercelEnv: string | undefined;
}

export function assertPreviewDatabaseIsNotProduction({
  databaseUrl,
  productionDbHost,
  vercelEnv,
}: DatabaseGuardInput): void {
  if (vercelEnv !== "preview") return;
  if (!productionDbHost?.trim()) {
    throw new Error(
      "PRODUCTION_DB_HOST is not set for the Preview environment. Refusing to run a preview without the production database guard.",
    );
  }
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set.");
  }
  const host = hostnameOf(databaseUrl);
  if (!host) {
    throw new Error("DATABASE_URL has no recognisable hostname.");
  }
  if (normaliseNeonHost(host) === normaliseNeonHost(productionDbHost)) {
    throw new Error(
      `Refusing to run this preview against the production database (${host}). Neon did not provide a branch database for this deployment.`,
    );
  }
}

// Not `new URL()`: an unescaped `@` or `:` in the password makes it throw or misparse the host.
// The userinfo runs up to the last `@` before the path, so those characters are tolerated;
// `/`, `?` and `#` must be percent-encoded, as in any URL.
export function hostnameOf(connectionString: string): string | undefined {
  const match = /^[a-z][a-z0-9+.-]*:\/\/(?:[^/?#]*@)?([^/:?#@]+)/i.exec(connectionString.trim());
  return match?.[1];
}

// Neon exposes the same endpoint as `ep-xxx-pooler.<region>` and `ep-xxx.<region>`.
export function normaliseNeonHost(host: string): string {
  return host
    .trim()
    .toLowerCase()
    .replace(/^([^.]+)-pooler\./, "$1.");
}

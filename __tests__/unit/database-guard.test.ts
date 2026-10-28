import { describe, expect, it } from "vitest";

import { assertPreviewDatabaseIsNotProduction } from "@/lib/database-guard";

const PROD_POOLED = "ep-cool-darkness-123456-pooler.eu-central-1.aws.neon.tech";
const PROD_DIRECT = "ep-cool-darkness-123456.eu-central-1.aws.neon.tech";
const BRANCH_POOLED = "ep-misty-frost-654321-pooler.eu-central-1.aws.neon.tech";

const url = (host: string, password = "s3cret") =>
  `postgresql://neondb_owner:${password}@${host}/neondb?sslmode=require`;

describe("assertPreviewDatabaseIsNotProduction", () => {
  it("does nothing outside the preview environment", () => {
    for (const vercelEnv of [undefined, "development", "production"]) {
      expect(() =>
        assertPreviewDatabaseIsNotProduction({
          databaseUrl: url(PROD_POOLED),
          productionDbHost: PROD_POOLED,
          vercelEnv,
        }),
      ).not.toThrow();
    }
  });

  it("refuses a preview without the production host configured", () => {
    expect(() =>
      assertPreviewDatabaseIsNotProduction({
        databaseUrl: url(BRANCH_POOLED),
        productionDbHost: undefined,
        vercelEnv: "preview",
      }),
    ).toThrow(/PRODUCTION_DB_HOST/);
  });

  it("refuses a preview whose database is production, in any pooled/direct combination", () => {
    for (const dbHost of [PROD_POOLED, PROD_DIRECT]) {
      for (const configured of [PROD_POOLED, PROD_DIRECT, ` ${PROD_DIRECT.toUpperCase()} `]) {
        expect(() =>
          assertPreviewDatabaseIsNotProduction({
            databaseUrl: url(dbHost),
            productionDbHost: configured,
            vercelEnv: "preview",
          }),
        ).toThrow(/production database/);
      }
    }
  });

  it("accepts a preview on a Neon branch database", () => {
    expect(() =>
      assertPreviewDatabaseIsNotProduction({
        databaseUrl: url(BRANCH_POOLED),
        productionDbHost: PROD_POOLED,
        vercelEnv: "preview",
      }),
    ).not.toThrow();
  });

  it("reads the host correctly when the password contains URL metacharacters", () => {
    const tricky = url(PROD_DIRECT, "p@ss:w0rd@2026");
    expect(() =>
      assertPreviewDatabaseIsNotProduction({
        databaseUrl: tricky,
        productionDbHost: PROD_POOLED,
        vercelEnv: "preview",
      }),
    ).toThrow(/production database/);
  });

  it("refuses a preview with a missing or malformed DATABASE_URL", () => {
    expect(() =>
      assertPreviewDatabaseIsNotProduction({
        databaseUrl: undefined,
        productionDbHost: PROD_POOLED,
        vercelEnv: "preview",
      }),
    ).toThrow(/DATABASE_URL is not set/);
    expect(() =>
      assertPreviewDatabaseIsNotProduction({
        databaseUrl: "not a url",
        productionDbHost: PROD_POOLED,
        vercelEnv: "preview",
      }),
    ).toThrow(/hostname/);
  });
});

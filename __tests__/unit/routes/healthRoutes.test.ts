// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET as getDatabaseHealth } from "@/app/api/health/db/route";
import { GET as getHealth } from "@/app/api/health/route";

const { pingDatabase } = vi.hoisted(() => ({ pingDatabase: vi.fn() }));

vi.mock("@/lib/dal", () => ({ pingDatabase }));
vi.mock("@/lib/dal/dal-health", () => ({ pingDatabase }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("answers ok without asking the database, and is never cached", async () => {
    const response = await getHealth();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
    expect(response.headers.get("cache-control")).toMatch(/no-store/);
    expect(pingDatabase).not.toHaveBeenCalled();
  });
});

describe("GET /api/health/db", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("answers ok when the database answers, and is never cached", async () => {
    pingDatabase.mockResolvedValue(true);

    const response = await getDatabaseHealth();

    expect(pingDatabase).toHaveBeenCalledOnce();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
    expect(response.headers.get("cache-control")).toMatch(/no-store/);
  });

  it("answers 503 with nothing but the status when the database does not answer, and is never cached", async () => {
    pingDatabase.mockResolvedValue(false);

    const response = await getDatabaseHealth();

    expect(response.status).toBe(503);
    expect(await response.json()).toStrictEqual({ status: "error" });
    expect(response.headers.get("cache-control")).toMatch(/no-store/);
  });
});

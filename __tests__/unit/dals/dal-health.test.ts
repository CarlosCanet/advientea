// @vitest-environment node
import * as Sentry from "@sentry/nextjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { pingDatabase } from "@/lib/dal/dal-health";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/prisma", () => ({ prisma: { $queryRaw: vi.fn() } }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

const queryRaw = vi.mocked(prisma.$queryRaw);

describe("pingDatabase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("is true when the database answers, and reports nothing", async () => {
    queryRaw.mockResolvedValue([{ "?column?": 1 }] as never);

    expect(await pingDatabase()).toBe(true);
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it("is false at once when the query fails, and reports the error", async () => {
    const failure = new Error("connection refused at db.internal:5432");
    queryRaw.mockRejectedValue(failure);

    expect(await pingDatabase()).toBe(false);
    expect(Sentry.captureException).toHaveBeenCalledWith(failure);
  });

  it("is false after five seconds when the database never answers, and reports it", async () => {
    vi.useFakeTimers();
    queryRaw.mockReturnValue(new Promise(() => {}) as never);
    let result: boolean | undefined;

    void pingDatabase().then((answer) => {
      result = answer;
    });
    await vi.advanceTimersByTimeAsync(4_999);
    expect(result).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);

    expect(result).toBe(false);
    expect(Sentry.captureException).toHaveBeenCalled();
  });
});

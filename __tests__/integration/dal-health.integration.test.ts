import { describe, expect, it } from "vitest";

import { pingDatabase } from "@/lib/dal";

describe("dal health", () => {
  describe("pingDatabase", () => {
    it("reports that the test database answers", async () => {
      expect(await pingDatabase()).toBe(true);
    });
  });
});

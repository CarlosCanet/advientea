import { describe, expect, it } from "vitest";

import { EditionStatus } from "@/generated/prisma/enums";
import { upsertEdition } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

describe("dal Edition", () => {
  describe("upsertEdition", () => {
    it("creates the edition once and only updates its status on a second call", async () => {
      const created = await upsertEdition(2030, EditionStatus.PREPARING);
      expect(created).toMatchObject({ name: "Advienté 2030", status: EditionStatus.PREPARING, year: 2030 });

      const again = await upsertEdition(2030, EditionStatus.ACTIVE);
      expect(again.status).toBe(EditionStatus.ACTIVE);
      expect(await prisma.edition.count({ where: { year: 2030 } })).toBe(1);

      await prisma.edition.delete({ where: { year: 2030 } });
    });
  });

  it("refuses to delete an edition that still has days", async () => {
    // The seed creates the 2025 edition with its 25 days before every test.
    await expect(prisma.edition.delete({ where: { year: 2025 } })).rejects.toThrow();
    expect(await prisma.edition.count({ where: { year: 2025 } })).toBe(1);
  });
});

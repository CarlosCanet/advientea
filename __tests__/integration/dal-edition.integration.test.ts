import { describe, expect, it } from "vitest";

import { EditionStatus } from "@/generated/prisma/enums";
import {
  activateEdition,
  archiveEdition,
  createEdition,
  deleteEdition,
  getAllEditions,
  getCurrentEdition,
  upsertEdition,
} from "@/lib/dal";
import { ConflictError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

describe("dal Edition", () => {
  // The seed makes 2025 the active edition before every test.
  describe("createEdition", () => {
    it("creates the edition in preparation, with its year and name", async () => {
      const created = await createEdition("Advienté de los cerezos", 2026);

      expect(created).toMatchObject({ name: "Advienté de los cerezos", status: EditionStatus.PREPARING, year: 2026 });
    });

    it("refuses a year that already has an edition", async () => {
      await expect(createEdition("Otra 2025", 2025)).rejects.toBeInstanceOf(ConflictError);
      expect(await prisma.edition.count({ where: { year: 2025 } })).toBe(1);
    });
  });

  describe("activateEdition", () => {
    it("activates an edition in preparation once no other is active", async () => {
      await upsertEdition(2025, EditionStatus.ARCHIVED);
      await createEdition("Advienté 2026", 2026);

      const activated = await activateEdition(2026);

      expect(activated.status).toBe(EditionStatus.ACTIVE);
    });

    it("refuses while another edition is active, naming it, and changes nothing", async () => {
      await createEdition("Advienté 2026", 2026);

      await expect(activateEdition(2026)).rejects.toThrow(/2025/);
      await expect(activateEdition(2026)).rejects.toBeInstanceOf(ConflictError);
      expect((await prisma.edition.findUniqueOrThrow({ where: { year: 2026 } })).status).toBe(EditionStatus.PREPARING);
    });

    it("refuses an edition that is not in preparation, or does not exist", async () => {
      await upsertEdition(2025, EditionStatus.ARCHIVED);

      await expect(activateEdition(2025)).rejects.toBeInstanceOf(ConflictError);
      await expect(activateEdition(2031)).rejects.toBeInstanceOf(ConflictError);
    });
  });

  describe("archiveEdition", () => {
    it("archives the active edition", async () => {
      const archived = await archiveEdition(2025);

      expect(archived.status).toBe(EditionStatus.ARCHIVED);
    });

    it("refuses an edition that is not active", async () => {
      await createEdition("Advienté 2026", 2026);

      await expect(archiveEdition(2026)).rejects.toBeInstanceOf(ConflictError);
      expect((await prisma.edition.findUniqueOrThrow({ where: { year: 2026 } })).status).toBe(EditionStatus.PREPARING);
    });
  });

  describe("deleteEdition", () => {
    it("deletes an empty edition in preparation", async () => {
      await createEdition("Advienté 2026", 2026);

      const deleted = await deleteEdition(2026);

      expect(deleted.year).toBe(2026);
      expect(await prisma.edition.count({ where: { year: 2026 } })).toBe(0);
    });

    it("refuses an empty edition that is active or archived", async () => {
      await upsertEdition(2025, EditionStatus.ARCHIVED);
      await upsertEdition(2026, EditionStatus.ACTIVE);
      await upsertEdition(2027, EditionStatus.ARCHIVED);

      await expect(deleteEdition(2026)).rejects.toBeInstanceOf(ConflictError);
      await expect(deleteEdition(2027)).rejects.toBeInstanceOf(ConflictError);
      expect(await prisma.edition.count({ where: { year: { in: [2026, 2027] } } })).toBe(2);
    });

    it("refuses an edition in preparation that already has a day", async () => {
      await createEdition("Advienté 2026", 2026);
      await prisma.day.create({ data: { dayNumber: 1, year: 2026 } });

      await expect(deleteEdition(2026)).rejects.toBeInstanceOf(ConflictError);
      expect(await prisma.edition.count({ where: { year: 2026 } })).toBe(1);
    });

    it("refuses an edition in preparation that already has someone enrolled without a day", async () => {
      await createEdition("Advienté 2026", 2026);
      await prisma.dayAssignment.create({ data: { guestName: "Prima Lejana", year: 2026 } });

      await expect(deleteEdition(2026)).rejects.toBeInstanceOf(ConflictError);
      expect(await prisma.edition.count({ where: { year: 2026 } })).toBe(1);
    });

    it("refuses a year with no edition", async () => {
      await expect(deleteEdition(2031)).rejects.toBeInstanceOf(ConflictError);
    });
  });

  describe("getAllEditions", () => {
    it("lists every edition, the newest first", async () => {
      await createEdition("Advienté 2027", 2027);
      await createEdition("Advienté 2026", 2026);

      expect((await getAllEditions()).map((edition) => edition.year)).toEqual([2027, 2026, 2025]);
    });
  });

  describe("getCurrentEdition", () => {
    it("is the active edition when there is one", async () => {
      // The seed makes 2025 the active edition.
      await upsertEdition(2026, EditionStatus.PREPARING);

      expect((await getCurrentEdition())?.year).toBe(2025);
    });

    it("is the edition being prepared while none is active", async () => {
      await upsertEdition(2025, EditionStatus.ARCHIVED);
      await upsertEdition(2026, EditionStatus.PREPARING);

      expect((await getCurrentEdition())?.year).toBe(2026);
    });

    it("is null when every edition is archived", async () => {
      await upsertEdition(2025, EditionStatus.ARCHIVED);

      expect(await getCurrentEdition()).toBeNull();
    });
  });

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

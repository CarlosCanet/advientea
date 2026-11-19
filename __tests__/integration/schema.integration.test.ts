import { describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";

describe("Schema rules & constrains", () => {
  describe("Deletes", () => {
    it("keeps the Tea, with its Participation, when the Day is deleted", async () => {
      const participation = await prisma.participation.findFirstOrThrow({
        include: { tea: true },
        where: { dayId: { not: null }, tea: { isNot: null } },
      });

      await prisma.day.delete({ where: { id: participation.dayId! } });

      const after = await prisma.participation.findUniqueOrThrow({
        include: { tea: true },
        where: { id: participation.id },
      });
      expect(after.dayId).toBeNull();
      expect(after.tea?.id).toBe(participation.tea!.id);
    });

    it("refuses to delete a Participation that has a Tea", async () => {
      const participation = await prisma.participation.findFirstOrThrow({ where: { tea: { isNot: null } } });

      await expect(prisma.participation.delete({ where: { id: participation.id } })).rejects.toThrow(/Foreign key/);
      expect(await prisma.tea.count({ where: { participationId: participation.id } })).toBe(1);
    });

    it("keeps the Tea when the User behind its Participation is deleted", async () => {
      const participation = await prisma.participation.findFirstOrThrow({
        include: { tea: true },
        where: { tea: { isNot: null }, userId: { not: null } },
      });

      await prisma.user.delete({ where: { id: participation.userId! } });

      const tea = await prisma.tea.findUniqueOrThrow({ where: { id: participation.tea!.id } });
      expect(tea.participationId).toBe(participation.id);
    });

    it("should keep the Participation, without user, when the User is deleted", async () => {
      // SetNull since the editions migration: the day and whatever hangs from it survive the user.
      const user = await prisma.user.findFirst({
        include: { participations: true },
        where: { participations: { some: {} } },
      });
      expect(user).not.toBeNull();
      expect(user!.participations.length).toBeGreaterThan(0);
      const participation = user!.participations[0];
      await prisma.user.delete({ where: { id: user!.id } });
      const participationCheck = await prisma.participation.findUnique({ where: { id: participation.id } });
      expect(participationCheck).toMatchObject({ dayId: participation.dayId, userId: null });
    });
  });

  describe("Unique Constraints", () => {
    it("should NOT allow two Teas for the same Participation", async () => {
      const participation = await prisma.participation.findFirstOrThrow({ where: { tea: { isNot: null } } });

      await expect(
        prisma.tea.create({
          data: {
            addMilk: false,
            canReinfuse: false,
            hasTheine: true,
            infusionTime: 1,
            name: "T2",
            participationId: participation.id,
            temperature: 100,
          },
        }),
      ).rejects.toThrow(/Unique constraint/);
    });
  });
});

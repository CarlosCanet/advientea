import { describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";

describe("Schema rules & constrains", () => {
  describe("Cascading deletes", () => {
    it("should delete Tea when Day is deleted (Cascade)", async () => {
      const day = await prisma.day.findFirst({ include: { tea: true }, where: { tea: { isNot: null } } });
      expect(day).not.toBeNull();
      expect(day!.tea).not.toBeNull();
      const teaId = day!.tea!.id;
      await prisma.day.delete({ where: { id: day!.id } });
      const teaCheck = await prisma.tea.findUnique({ where: { id: teaId } });
      expect(teaCheck).toBeNull();
    });

    it("should keep the Assignment, without user, when the User is deleted", async () => {
      // SetNull since the editions migration: the day and whatever hangs from it survive the user.
      const user = await prisma.user.findFirst({
        include: { daysAssigned: true },
        where: { daysAssigned: { some: {} } },
      });
      expect(user).not.toBeNull();
      expect(user!.daysAssigned.length).toBeGreaterThan(0);
      const assignment = user!.daysAssigned[0];
      await prisma.user.delete({ where: { id: user!.id } });
      const assignmentCheck = await prisma.dayAssignment.findUnique({ where: { id: assignment.id } });
      expect(assignmentCheck).toMatchObject({ dayId: assignment.dayId, userId: null });
    });
  });

  describe("Unique Constraints", () => {
    it("should NOT allow two Teas for the same Day", async () => {
      const day = await prisma.day.findFirst({ where: { tea: { isNot: null } } });
      expect(day).not.toBeNull();

      await expect(
        prisma.tea.create({
          data: {
            addMilk: false,
            canReinfuse: false,
            dayId: day!.id,
            hasTheine: true,
            infusionTime: 1,
            name: "T2",
            temperature: 100,
          },
        }),
      ).rejects.toThrow(/Unique constraint/);
    });
  });
});

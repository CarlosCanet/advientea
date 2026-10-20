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

    it("should delete Assignments when User is deleted", async () => {
      const user = await prisma.user.findFirst({
        include: { daysAssigned: true },
        where: { daysAssigned: { some: {} } },
      });
      expect(user).not.toBeNull();
      expect(user!.daysAssigned.length).toBeGreaterThan(0);
      const assignmentId = user!.daysAssigned[0].id;
      await prisma.user.delete({ where: { id: user!.id } });
      const assignmentCheck = await prisma.dayAssignment.findUnique({ where: { id: assignmentId } });
      expect(assignmentCheck).toBeNull();
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

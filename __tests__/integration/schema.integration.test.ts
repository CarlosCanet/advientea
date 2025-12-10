import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";

describe("Schema rules & constrains", () => {
  describe("Cascading deletes", () => {
    it("should delete Tea when Day is deleted (Cascade)", async () => {
      const day = await prisma.day.findFirst({ where: { tea: { isNot: null } }, include: { tea: true } });
      expect(day).not.toBeNull();
      expect(day!.tea).not.toBeNull();
      const teaId = day!.tea!.id;
      await prisma.day.delete({ where: { id: day!.id } });
      const teaCheck = await prisma.tea.findUnique({ where: { id: teaId } });
      expect(teaCheck).toBeNull();
    });

    it("should delete Assignments when User is deleted", async () => {
      const user = await prisma.user.findFirst({
        where: { daysAssigned: { some: {} } },
        include: { daysAssigned: true },
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
          data: { name: "T2", dayId: day!.id, infusionTime: 1, temperature: 100, hasTheine: true, canReinfuse: false, addMilk: false },
        })
      ).rejects.toThrow(/Unique constraint/);
    });
  });
});

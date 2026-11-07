import { describe, expect, it } from "vitest";

import { assignDay, deleteDay, getDayByDayNumber } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

describe("dal Day", () => {
  describe("deleteDay", () => {
    it("deletes the assignment with the day, so the person can be assigned again that year", async () => {
      // The seed assigns day 1 of 2025 to the manager.
      const day = await prisma.day.findUniqueOrThrow({
        include: { assignment: true },
        where: { dayNumber_year: { dayNumber: 1, year: 2025 } },
      });
      const userId = day.assignment?.userId;
      expect(userId).toBeTruthy();

      await deleteDay(day.id);

      const orphan = await prisma.dayAssignment.findFirst({ where: { userId: userId!, year: 2025 } });
      expect(orphan).toBeNull();

      const six = await getDayByDayNumber({ dayNumber: 6, year: 2025 });
      const reassigned = await assignDay(six!.id, { userId: userId! }, new Date("2025-11-15T12:00:00+01:00"));
      expect(reassigned.day?.dayNumber).toBe(6);
    });
  });
});

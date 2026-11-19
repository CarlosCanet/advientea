import { describe, expect, it } from "vitest";

import { assignDay, deleteDay, getDayByDayNumber, getDayById, getDayForGuessing } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

// The seed gives day 1 of 2025 to the manager and day 2 to the guest "Anónimo", both with a tea;
// days 3, 4 and 5 go to ana, sony and miko without one, and the rest are free.
async function seededDay(dayNumber: number) {
  return prisma.day.findUniqueOrThrow({
    include: { participation: { include: { tea: true } } },
    where: { dayNumber_year: { dayNumber, year: 2025 } },
  });
}

describe("dal Day", () => {
  describe("getDayById", () => {
    it("returns the tea of whoever holds the day, with its story and images in order", async () => {
      const day = await getDayById((await seededDay(1)).id);

      expect(day?.participation?.tea?.name).toBe("Ruta del desierto");
      expect(day?.participation?.tea?.story?.images.map((image) => image.order)).toEqual([0, 1, 2]);
    });

    it("loads nothing about who holds the day", async () => {
      const day = await getDayById((await seededDay(2)).id);

      expect(Object.keys(day!.participation!)).toEqual(["tea"]);
      expect(JSON.stringify(day)).not.toContain("Anónimo");
    });

    it("returns no tea for a day whose holder has not uploaded one, nor for a free day", async () => {
      const held = await getDayById((await seededDay(3)).id);
      const free = await getDayById((await seededDay(6)).id);

      expect(held?.participation).toEqual({ tea: null });
      expect(free?.participation).toBeNull();
    });
  });

  describe("getDayForGuessing", () => {
    it("returns the tea and the holder of the day, by account or by guest name", async () => {
      const one = await getDayForGuessing((await seededDay(1)).id);
      const two = await getDayForGuessing((await seededDay(2)).id);

      expect(one?.participation?.user?.username).toBe("Deinos");
      expect(one?.participation?.tea).toMatchObject({ name: "Ruta del desierto" });
      expect(one?.participation?.tea?.ingredients).toHaveLength(2);
      expect(two?.participation).toMatchObject({ guestName: "Anónimo", tea: { name: "Pakistaní" }, user: null });
    });
  });

  describe("deleteDay", () => {
    it("keeps whoever held the day in the edition, without a day and with their tea", async () => {
      const day = await seededDay(1);
      const participation = day.participation!;
      expect(participation.tea).not.toBeNull();

      await deleteDay(day.id);

      expect(await prisma.day.findUnique({ where: { id: day.id } })).toBeNull();
      const after = await prisma.participation.findUniqueOrThrow({
        include: { tea: true },
        where: { id: participation.id },
      });
      expect(after.dayId).toBeNull();
      expect(after.tea?.id).toBe(participation.tea!.id);
    });

    it("lets that person be given another day afterwards, on the same participation", async () => {
      const day = await seededDay(1);
      const participation = day.participation!;
      await deleteDay(day.id);

      const six = await getDayByDayNumber({ dayNumber: 6, year: 2025 });
      const reassigned = await assignDay(
        six!.id,
        { userId: participation.userId! },
        new Date("2025-11-15T12:00:00+01:00"),
      );

      expect(reassigned.id).toBe(participation.id);
      expect(reassigned.day?.dayNumber).toBe(6);
    });
  });
});

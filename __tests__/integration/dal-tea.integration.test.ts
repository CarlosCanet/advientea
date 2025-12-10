import { describe, expect, it, vi, beforeAll, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma"; // El real
import { addTea } from "@/lib/dal/dal-tea";
import { TeaType } from "@/generated/prisma/enums";

describe("dal Tea", () => {
  it("should create a tea linked to a real day in the DB", async () => {
    const newTea = await addTea(
      {
        name: "Integration Tea",
        teaType: TeaType.GREEN,
        infusionTime: 3,
        temperature: 80,
        hasTheine: true,
        canReinfuse: false,
        addMilk: false,
      },
      20,
      2025
    );

    expect(newTea).not.toBeNull();
    expect(newTea?.day?.dayNumber).toBe(20);

    const savedInDb = await prisma.tea.findUnique({ where: { id: newTea!.id } });
    expect(savedInDb?.name).toBe("Integration Tea");
  });

  it("should enforce Unique Constraint on DayId", async () => {
    await addTea(
      { name: "Tea 21", teaType: TeaType.BLACK, infusionTime: 1, temperature: 1, hasTheine: true, canReinfuse: true, addMilk: true },
      21,
      2025
    );
    await expect(
      addTea({ name: "Tea 21", teaType: TeaType.WHITE, infusionTime: 1, temperature: 1, hasTheine: true, canReinfuse: true, addMilk: true }, 21, 2025)
    ).rejects.toThrow();
  });
});

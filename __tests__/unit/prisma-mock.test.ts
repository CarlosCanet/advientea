/**
 * @jest-environment node
 * 
 * Simple test to verify Prisma Client mocking works correctly
 */

import { prismaMock } from "../singleton";
import { TeaType } from "@/generated/prisma/client";

describe("Prisma Mock Test", () => {
  it("should mock prisma.tea.findUnique correctly", async () => {
    const mockTea = {
      id: "test-id",
      name: "Earl Grey",
      teaType: TeaType.BLACK,
      infusionTime: 3,
      temperature: 100,
      hasTheine: true,
      canReinfuse: false,
      reinfuseNumber: null,
      moreIndications: null,
      addMilk: false,
      storeName: null,
      url: null,
      dayId: "day-id",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    prismaMock.tea.findUnique.mockResolvedValue(mockTea);

    const result = await prismaMock.tea.findUnique({
      where: { id: "test-id" },
    });

    expect(result).toEqual(mockTea);
    expect(result?.name).toBe("Earl Grey");
    expect(prismaMock.tea.findUnique).toHaveBeenCalledWith({
      where: { id: "test-id" },
    });
  });

  it("should mock prisma.tea.findMany correctly", async () => {
    const mockTeas = [
      {
        id: "tea-1",
        name: "Green Tea",
        teaType: TeaType.GREEN,
        infusionTime: 2,
        temperature: 80,
        hasTheine: true,
        canReinfuse: true,
        reinfuseNumber: 3,
        moreIndications: null,
        addMilk: false,
        storeName: null,
        url: null,
        dayId: "day-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    prismaMock.tea.findMany.mockResolvedValue(mockTeas);

    const result = await prismaMock.tea.findMany();

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Green Tea");
    expect(prismaMock.tea.findMany).toHaveBeenCalled();
  });

  it("should reset mock between tests", async () => {
    // This test verifies that mockReset in singleton.ts works
    expect(prismaMock.tea.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.tea.findMany).not.toHaveBeenCalled();
  });
});

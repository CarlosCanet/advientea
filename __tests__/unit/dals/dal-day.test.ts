import { beforeAll, describe, expect, it, vi } from "vitest";

import { Day, Prisma, TeaType } from "@/generated/prisma/client";
import { prismaMock } from "@/lib/__mocks__/prisma";
import {
  add25Days,
  addDay,
  addNextDay,
  DayWithAssignmentAndTeaComplete,
  DayWithTeaComplete,
  deleteDay,
  editDay,
  getAllDays,
  getDay,
} from "@/lib/dal/dal-day";

describe("DAL Day", () => {
  beforeAll(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("getDay", () => {
    const mockDayComplete: DayWithTeaComplete = {
      createdAt: new Date(),
      dayNumber: 1,
      id: "day-1",
      tea: {
        addMilk: false,
        canReinfuse: false,
        createdAt: new Date(),
        dayId: "day-1",
        hasTheine: true,
        id: "tea-1",
        infusionTime: 3,
        moreIndications: null,
        name: "Test Tea",
        reinfuseNumber: null,
        storeName: null,
        story: {
          createdAt: new Date(),
          id: "story-1",
          images: [],
          onlyMusic: false,
          storyPart1: "Text",
          storyPart2: null,
          storyPart3: null,
          teaId: "tea-1",
          updatedAt: new Date(),
          youtubeURL: null,
        },
        teaType: TeaType.GREEN,
        temperature: 80,
        updatedAt: new Date(),
        url: null,
      },
      updatedAt: new Date(),
      year: 2025,
    };

    it("should get day by UUID string", async () => {
      prismaMock.day.findUnique.mockResolvedValue(mockDayComplete);

      const result = await getDay("day-1");

      expect(result).toEqual(mockDayComplete);
      expect(prismaMock.day.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "day-1" },
        }),
      );
    });

    it("should get day by dayNumber (number)", async () => {
      prismaMock.day.findUnique.mockResolvedValue(mockDayComplete);

      const result = await getDay(1, 2025);

      expect(result).toEqual(mockDayComplete);
      expect(prismaMock.day.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { dayNumber_year: { dayNumber: 1, year: 2025 } },
        }),
      );
    });

    it("should return null if day not found", async () => {
      prismaMock.day.findUnique.mockResolvedValue(null);
      const result = await getDay(99, 2025);
      expect(result).toBeNull();
    });
  });

  describe("getAllDays", () => {
    it("should return array of days ordered by number", async () => {
      const mockDays: DayWithAssignmentAndTeaComplete[] = [
        {
          assignment: null,
          createdAt: new Date(),
          dayNumber: 1,
          id: "day-1",
          tea: null,
          updatedAt: new Date(),
          year: 2025,
        },
        {
          assignment: null,
          createdAt: new Date(),
          dayNumber: 2,
          id: "day-2",
          tea: null,
          updatedAt: new Date(),
          year: 2025,
        },
      ];

      prismaMock.day.findMany.mockResolvedValue(mockDays);

      const result = await getAllDays(2025);

      expect(result).toHaveLength(2);
      expect(prismaMock.day.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { dayNumber: "asc" },
          where: { year: 2025 },
        }),
      );
    });
  });

  describe("addDay", () => {
    it("should create day successfully", async () => {
      const mockCreatedDay: Day = {
        createdAt: new Date(),
        dayNumber: 5,
        id: "day-new",
        updatedAt: new Date(),
        year: 2025,
      };
      prismaMock.day.create.mockResolvedValue(mockCreatedDay);

      const result = await addDay(5, 2025);
      expect(result).toEqual(mockCreatedDay);
    });

    it("should return null (and log error) on P2002 unique constraint violation", async () => {
      const p2002Error = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        clientVersion: "1",
        code: "P2002",
      });
      prismaMock.day.create.mockRejectedValue(p2002Error);
      const result = await addDay(5, 2025);

      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining("already exists"));
    });

    it("should throw on other unknown errors", async () => {
      const genericError = new Error("DB connection failed");
      prismaMock.day.create.mockRejectedValue(genericError);

      await expect(addDay(5)).rejects.toThrow("DB connection failed");
    });
  });

  describe("addNextDay", () => {
    it("should increment max day number", async () => {
      prismaMock.day.aggregate.mockResolvedValue({
        _avg: {},
        _count: {},
        _max: { dayNumber: 4 },
        _min: {},
        _sum: {},
      });

      const mockNewDay: Day = {
        createdAt: new Date(),
        dayNumber: 5,
        id: "day-5",
        updatedAt: new Date(),
        year: 2025,
      };
      prismaMock.day.create.mockResolvedValue(mockNewDay);

      await addNextDay(2025);

      expect(prismaMock.day.create).toHaveBeenCalledWith({
        data: { dayNumber: 5, year: 2025 },
      });
    });

    it("should start at 1 if no days exist", async () => {
      prismaMock.day.aggregate.mockResolvedValue({
        _avg: {},
        _count: {},
        _max: { dayNumber: null },
        _min: {},
        _sum: {},
      });

      await addNextDay(2025);

      expect(prismaMock.day.create).toHaveBeenCalledWith({
        data: { dayNumber: 1, year: 2025 },
      });
    });

    it("should handle P2002 conflict in addNextDay", async () => {
      prismaMock.day.aggregate.mockResolvedValue({
        _avg: {},
        _count: {},
        _max: { dayNumber: 4 },
        _min: {},
        _sum: {},
      });

      const p2002Error = new Prisma.PrismaClientKnownRequestError("Unique constraint", {
        clientVersion: "1",
        code: "P2002",
      });
      prismaMock.day.create.mockRejectedValue(p2002Error);

      const result = await addNextDay(2025);
      expect(result).toBeNull();
    });
  });

  describe("add25Days", () => {
    it("should batch create 25 days skipping duplicates", async () => {
      prismaMock.day.createMany.mockResolvedValue({ count: 25 });

      const count = await add25Days(2025);

      expect(count).toBe(25);
      expect(prismaMock.day.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          { dayNumber: 1, year: 2025 },
          { dayNumber: 25, year: 2025 },
        ]),
        skipDuplicates: true,
      });
    });
  });

  describe("editDay", () => {
    it("should update a day successfully", async () => {
      const mockUpdatedDay: Day = {
        createdAt: new Date(),
        dayNumber: 10,
        id: "day-1",
        updatedAt: new Date(),
        year: 2025,
      };

      prismaMock.day.update.mockResolvedValue(mockUpdatedDay);

      const updateData = { dayNumber: 10 };
      const result = await editDay(updateData, "day-1");

      expect(result).toEqual(mockUpdatedDay);

      expect(prismaMock.day.update).toHaveBeenCalledWith({
        data: updateData,
        where: { id: "day-1" },
      });
    });

    it("should throw error if day to update does not exist", async () => {
      const p2025Error = new Prisma.PrismaClientKnownRequestError("Record to update not found.", {
        clientVersion: "1",
        code: "P2025",
      });

      prismaMock.day.update.mockRejectedValue(p2025Error);

      await expect(editDay({ dayNumber: 20 }, "missing-id")).rejects.toThrow("Record to update not found.");
    });
  });

  describe("deleteDay", () => {
    it("should delete day and return relations", async () => {
      const mockDeleted: Day = {
        createdAt: new Date(),
        dayNumber: 1,
        id: "day-1",
        updatedAt: new Date(),
        year: 2025,
      };
      prismaMock.day.delete.mockResolvedValue(mockDeleted);

      await deleteDay("day-1");

      expect(prismaMock.day.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.anything(),
          where: { id: "day-1" },
        }),
      );
    });
  });
});

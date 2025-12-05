/**
 * @jest-environment node
 */

import { Day, Prisma, TeaType } from "@/generated/prisma/client";
import { prismaMock } from "../../singleton";
import {
  getDay,
  getAllDays,
  addDay,
  addNextDay,
  add25Days,
  editDay,
  deleteDay,
  DayWithTeaComplete,
  DayWithAssignmentAndTeaComplete,
} from "@/lib/dal/dal-day";

describe("DAL Day", () => {
  beforeAll(() => {
    jest.spyOn(console, "error").mockImplementation(() => { });
  });

  describe("getDay", () => {
    const mockDayComplete: DayWithTeaComplete = {
      id: "day-1",
      dayNumber: 1,
      year: 2025,
      createdAt: new Date(),
      updatedAt: new Date(),
      tea: {
        id: "tea-1",
        dayId: "day-1",
        name: "Test Tea",
        teaType: TeaType.GREEN,
        infusionTime: 3,
        temperature: 80,
        hasTheine: true,
        canReinfuse: false,
        reinfuseNumber: null,
        moreIndications: null,
        addMilk: false,
        storeName: null,
        url: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        story: {
          id: "story-1",
          teaId: "tea-1",
          storyPart1: "Text",
          storyPart2: null,
          storyPart3: null,
          youtubeURL: null,
          onlyMusic: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          images: [],
        },
      },
    };

    it("should get day by UUID string", async () => {
      prismaMock.day.findUnique.mockResolvedValue(mockDayComplete);

      const result = await getDay("day-1");

      expect(result).toEqual(mockDayComplete);
      expect(prismaMock.day.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "day-1" },
        })
      );
    });

    it("should get day by dayNumber (number)", async () => {
      prismaMock.day.findUnique.mockResolvedValue(mockDayComplete);

      const result = await getDay(1, 2025);

      expect(result).toEqual(mockDayComplete);
      expect(prismaMock.day.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { dayNumber_year: { dayNumber: 1, year: 2025 } },
        })
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
        { id: "day-1", dayNumber: 1, year: 2025, tea: null, assignment: null, createdAt: new Date(), updatedAt: new Date() },
        { id: "day-2", dayNumber: 2, year: 2025, tea: null, assignment: null, createdAt: new Date(), updatedAt: new Date() },
      ];

      prismaMock.day.findMany.mockResolvedValue(mockDays);

      const result = await getAllDays(2025);

      expect(result).toHaveLength(2);
      expect(prismaMock.day.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { year: 2025 },
          orderBy: { dayNumber: "asc" },
        })
      );
    });
  });

  describe("addDay", () => {
    it("should create day successfully", async () => {
      const mockCreatedDay: Day = {
        id: "day-new",
        dayNumber: 5,
        year: 2025,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      prismaMock.day.create.mockResolvedValue(mockCreatedDay);

      const result = await addDay(5, 2025);
      expect(result).toEqual(mockCreatedDay);
    });

    it("should return null (and log error) on P2002 unique constraint violation", async () => {
      const p2002Error = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", { code: "P2002", clientVersion: "1" });
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
        _max: { dayNumber: 4 },
        _min: {},
        _avg: {},
        _sum: {},
        _count: {},
      });

      const mockNewDay: Day = {
        id: "day-5",
        dayNumber: 5,
        year: 2025,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      prismaMock.day.create.mockResolvedValue(mockNewDay);

      await addNextDay(2025);

      expect(prismaMock.day.create).toHaveBeenCalledWith({
        data: { dayNumber: 5, year: 2025 },
      });
    });

    it("should start at 1 if no days exist", async () => {
      prismaMock.day.aggregate.mockResolvedValue({
        _max: { dayNumber: null },
        _min: {},
        _avg: {},
        _sum: {},
        _count: {},
      });

      await addNextDay(2025);

      expect(prismaMock.day.create).toHaveBeenCalledWith({
        data: { dayNumber: 1, year: 2025 },
      });
    });

    it("should handle P2002 conflict in addNextDay", async () => {
      prismaMock.day.aggregate.mockResolvedValue({
        _max: { dayNumber: 4 },
        _min: {},
        _avg: {},
        _sum: {},
        _count: {},
      });

      const p2002Error = new Prisma.PrismaClientKnownRequestError("Unique constraint", { code: "P2002", clientVersion: "1" });
      prismaMock.day.create.mockRejectedValue(p2002Error);
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      const result = await addNextDay(2025);
      expect(result).toBeNull();

      consoleSpy.mockRestore();
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
        id: "day-1",
        dayNumber: 10,
        year: 2025,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prismaMock.day.update.mockResolvedValue(mockUpdatedDay);

      const updateData = { dayNumber: 10 };
      const result = await editDay(updateData, "day-1");

      expect(result).toEqual(mockUpdatedDay);
      
      expect(prismaMock.day.update).toHaveBeenCalledWith({
        where: { id: "day-1" },
        data: updateData,
      });
    });

    it("should throw error if day to update does not exist", async () => {
      const p2025Error = new Prisma.PrismaClientKnownRequestError(
        "Record to update not found.",
        { code: "P2025", clientVersion: "1" }
      );
      
      prismaMock.day.update.mockRejectedValue(p2025Error);

      await expect(editDay({ dayNumber: 20 }, "missing-id"))
        .rejects
        .toThrow("Record to update not found.");
    });
  });

  describe("deleteDay", () => {
    it("should delete day and return relations", async () => {
      const mockDeleted: Day = {
        id: "day-1",
        dayNumber: 1,
        year: 2025,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      prismaMock.day.delete.mockResolvedValue(mockDeleted);

      await deleteDay("day-1");

      expect(prismaMock.day.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "day-1" },
          include: expect.anything(),
        })
      );
    });
  });
});

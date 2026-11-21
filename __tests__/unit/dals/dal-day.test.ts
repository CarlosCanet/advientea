import { beforeAll, describe, expect, it, vi } from "vitest";

import { Day, Prisma, TeaType } from "@/generated/prisma/client";
import { prismaMock } from "@/lib/__mocks__/prisma";
import {
  DayWithParticipationTeaStoryImages,
  DayWithParticipationTeaStoryImagesAndUser,
  editDay,
  getAllDays,
  getDayByDayNumber,
  getDayById,
} from "@/lib/dal/dal-day";

describe("DAL Day", () => {
  beforeAll(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("getDay", () => {
    const mockDayComplete: DayWithParticipationTeaStoryImages = {
      createdAt: new Date(),
      dayNumber: 1,
      id: "day-1",
      participation: {
        tea: {
          addMilk: false,
          canReinfuse: false,
          createdAt: new Date(),
          hasTheine: true,
          id: "tea-1",
          infusionTime: 3,
          moreIndications: null,
          name: "Test Tea",
          participationId: "participation-1",
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
      },
      updatedAt: new Date(),
      year: 2025,
    };

    it("should get day by UUID string", async () => {
      prismaMock.day.findUnique.mockResolvedValue(mockDayComplete);

      const result = await getDayById("day-1");

      expect(result).toEqual(mockDayComplete);
      expect(prismaMock.day.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "day-1" },
        }),
      );
    });

    it("should get day by dayNumber (number)", async () => {
      prismaMock.day.findUnique.mockResolvedValue(mockDayComplete);

      const result = await getDayByDayNumber({ dayNumber: 1, year: 2025 });

      expect(result).toEqual(mockDayComplete);
      expect(prismaMock.day.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { dayNumber_year: { dayNumber: 1, year: 2025 } },
        }),
      );
    });

    it("should return null if day not found", async () => {
      prismaMock.day.findUnique.mockResolvedValue(null);
      const result = await getDayByDayNumber({ dayNumber: 99, year: 2025 });
      expect(result).toBeNull();
    });
  });

  describe("getAllDays", () => {
    it("should return array of days ordered by number", async () => {
      const mockDays: DayWithParticipationTeaStoryImagesAndUser[] = [
        {
          createdAt: new Date(),
          dayNumber: 1,
          id: "day-1",
          participation: null,
          updatedAt: new Date(),
          year: 2025,
        },
        {
          createdAt: new Date(),
          dayNumber: 2,
          id: "day-2",
          participation: null,
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
});

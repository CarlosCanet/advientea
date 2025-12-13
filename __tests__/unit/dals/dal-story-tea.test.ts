import { prismaMock } from '@/lib/__mocks__/prisma';
import { describe, expect, it, vi, beforeAll } from 'vitest'
import { Tea, TeaType } from "@/generated/prisma/client";
import {
  getStoryTea,
  getAllStoriesTea,
  addStoryTea,
  editStoryTea,
  deleteStoryTea,
  StoryWithTeaAndImages,
  StoryWithTea,
} from "@/lib/dal/dal-story-tea";

// dal-day MOCK
import * as dalDay from "@/lib/dal/dal-day";
vi.mock("@/lib/dal/dal-day");
const dalDayMock = vi.mocked(dalDay);

describe("DAL StoryTea", () => {
  beforeAll(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("getStoryTea", () => {
    const mockStoryComplete: StoryWithTeaAndImages = {
      id: "story-1",
      teaId: "tea-1",
      storyPart1: "Once upon a time",
      storyPart2: null,
      storyPart3: null,
      youtubeURL: null,
      onlyMusic: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      images: [],
      tea: {
        id: "tea-1",
        dayId: "day-1",
        name: "Earl Grey",
        teaType: TeaType.BLACK,
        infusionTime: 3,
        temperature: 100,
        hasTheine: true,
        canReinfuse: true,
        reinfuseNumber: null,
        moreIndications: null,
        addMilk: true,
        storeName: null,
        url: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };

    it("should get story by ID string", async () => {
      prismaMock.storyTea.findUnique.mockResolvedValue(mockStoryComplete);

      const result = await getStoryTea("story-1");

      expect(result).toEqual(mockStoryComplete);
      expect(prismaMock.storyTea.findUnique).toHaveBeenCalledWith({
        where: { id: "story-1" },
        include: { tea: true, images: true },
      });
    });

    it("should return null if ID not found", async () => {
      prismaMock.storyTea.findUnique.mockResolvedValue(null);
      const result = await getStoryTea("missing");
      expect(result).toBeNull();
    });

    it("should get story by Day and reconstruct object", async () => {
      const mockDayResponse: dalDay.DayWithTeaComplete = {
        id: "day-1",
        dayNumber: 5,
        year: 2025,
        createdAt: new Date(),
        updatedAt: new Date(),
        tea: {
          ...mockStoryComplete.tea,
          story: {
            ...mockStoryComplete,
          },
        },
      };

      const realGetDayResponse = {
        ...mockDayResponse,
        tea: {
          ...mockDayResponse.tea!,
          story: {
            id: "story-1",
            teaId: "tea-1",
            storyPart1: "Once upon a time",
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

      dalDayMock.getDay.mockResolvedValue(realGetDayResponse);

      const result = await getStoryTea(5, 2025);

      expect(dalDayMock.getDay).toHaveBeenCalledWith(5, 2025);
      expect(result).toBeDefined();
      expect(result?.id).toBe("story-1");
      expect(result?.tea.id).toBe("tea-1");
      expect(result?.tea.name).toBe("Earl Grey");
    });

    it("should return null if day not found", async () => {
      dalDayMock.getDay.mockResolvedValue(null);
      const result = await getStoryTea(5, 2025);
      expect(result).toBeNull();
    });

    it("should return null if day has no tea", async () => {
      const mockDayNoTea: dalDay.DayWithTeaComplete = {
        id: "day-1",
        dayNumber: 5,
        year: 2025,
        createdAt: new Date(),
        updatedAt: new Date(),
        tea: null,
      };
      dalDayMock.getDay.mockResolvedValue(mockDayNoTea);

      const result = await getStoryTea(5, 2025);
      expect(result).toBeNull();
    });

    it("should return null if tea has no story", async () => {
      const mockDayNoStory: dalDay.DayWithTeaComplete = {
        id: "day-1",
        dayNumber: 5,
        year: 2025,
        createdAt: new Date(),
        updatedAt: new Date(),
        tea: {
          id: "tea-1",
          dayId: "day-1",
          name: "Tea",
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
          story: null,
        },
      };
      dalDayMock.getDay.mockResolvedValue(mockDayNoStory);

      const result = await getStoryTea(5, 2025);
      expect(result).toBeNull();
    });
  });

  describe("getAllStoriesTea", () => {
    it("should return all stories", async () => {
      prismaMock.storyTea.findMany.mockResolvedValue([]);
      await getAllStoriesTea();
      expect(prismaMock.storyTea.findMany).toHaveBeenCalledWith({
        include: { tea: true, images: { orderBy: { order: "asc" } } },
      });
    });

    it("should rethrow error on failure", async () => {
      const error = new Error("DB Error");
      prismaMock.storyTea.findMany.mockRejectedValue(error);
      await expect(getAllStoriesTea()).rejects.toThrow("DB Error");
    });
  });

  describe("addStoryTea", () => {
    it("should create story connected to tea", async () => {
      const mockCreated: StoryWithTea = {
        id: "new-story",
        teaId: "tea-1",
        storyPart1: "Intro",
        storyPart2: null,
        storyPart3: null,
        youtubeURL: null,
        onlyMusic: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        tea: { id: "tea-1" } as Tea,
      };

      prismaMock.storyTea.create.mockResolvedValue(mockCreated);

      const inputData = { storyPart1: "Intro" };
      const result = await addStoryTea(inputData, "tea-1");

      expect(result).toEqual(mockCreated);
      expect(prismaMock.storyTea.create).toHaveBeenCalledWith({
        data: {
          ...inputData,
          tea: { connect: { id: "tea-1" } },
        },
        include: { tea: true },
      });
    });
  });

  describe("editStoryTea", () => {
    it("should update story", async () => {
      const mockUpdated: StoryWithTea = {
        id: "s1",
        teaId: "t1",
        storyPart1: "Updated",
        storyPart2: null,
        storyPart3: null,
        youtubeURL: null,
        onlyMusic: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        tea: { id: "t1" } as Tea,
      };
      prismaMock.storyTea.update.mockResolvedValue(mockUpdated);

      const result = await editStoryTea({ storyPart1: "Updated" }, "s1");
      expect(result.storyPart1).toBe("Updated");
      expect(prismaMock.storyTea.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "s1" },
          data: { storyPart1: "Updated" },
        })
      );
    });
  });

  describe("deleteStoryTea", () => {
    it("should delete story", async () => {
      const mockDeleted: StoryWithTea = {
        id: "s1",
        teaId: "t1",
        storyPart1: "Del",
        storyPart2: null,
        storyPart3: null,
        youtubeURL: null,
        onlyMusic: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        tea: { id: "t1" } as Tea,
      };
      prismaMock.storyTea.delete.mockResolvedValue(mockDeleted);

      const result = await deleteStoryTea("s1");
      expect(result.id).toBe("s1");
      expect(prismaMock.storyTea.delete).toHaveBeenCalledWith({
        where: { id: "s1" },
        include: { tea: true },
      });
    });
  });
});

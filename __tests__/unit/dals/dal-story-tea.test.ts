import { beforeAll, describe, expect, it, vi } from "vitest";

import { Tea, TeaType } from "@/generated/prisma/client";
import { prismaMock } from "@/lib/__mocks__/prisma";
// dal-day MOCK
import * as dalDay from "@/lib/dal/dal-day";
import {
  addStoryTea,
  deleteStoryTea,
  editStoryTea,
  getAllStoriesTea,
  getStoryTea,
  StoryWithTea,
  StoryWithTeaAndImages,
} from "@/lib/dal/dal-story-tea";
vi.mock("@/lib/dal/dal-day");
const dalDayMock = vi.mocked(dalDay);

describe("DAL StoryTea", () => {
  beforeAll(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("getStoryTea", () => {
    const mockStoryComplete: StoryWithTeaAndImages = {
      createdAt: new Date(),
      id: "story-1",
      images: [],
      onlyMusic: false,
      storyPart1: "Once upon a time",
      storyPart2: null,
      storyPart3: null,
      tea: {
        addMilk: true,
        canReinfuse: true,
        createdAt: new Date(),
        dayId: "day-1",
        hasTheine: true,
        id: "tea-1",
        infusionTime: 3,
        moreIndications: null,
        name: "Earl Grey",
        reinfuseNumber: null,
        storeName: null,
        teaType: TeaType.BLACK,
        temperature: 100,
        updatedAt: new Date(),
        url: null,
      },
      teaId: "tea-1",
      updatedAt: new Date(),
      youtubeURL: null,
    };

    it("should get story by ID string", async () => {
      prismaMock.storyTea.findUnique.mockResolvedValue(mockStoryComplete);

      const result = await getStoryTea("story-1");

      expect(result).toEqual(mockStoryComplete);
      expect(prismaMock.storyTea.findUnique).toHaveBeenCalledWith({
        include: { images: true, tea: true },
        where: { id: "story-1" },
      });
    });

    it("should return null if ID not found", async () => {
      prismaMock.storyTea.findUnique.mockResolvedValue(null);
      const result = await getStoryTea("missing");
      expect(result).toBeNull();
    });

    it("should get story by Day and reconstruct object", async () => {
      const mockDayResponse: dalDay.DayWithTeaComplete = {
        createdAt: new Date(),
        dayNumber: 5,
        id: "day-1",
        tea: {
          ...mockStoryComplete.tea,
          story: {
            ...mockStoryComplete,
          },
        },
        updatedAt: new Date(),
        year: 2025,
      };

      const realGetDayResponse = {
        ...mockDayResponse,
        tea: {
          ...mockDayResponse.tea!,
          story: {
            createdAt: new Date(),
            id: "story-1",
            images: [],
            onlyMusic: false,
            storyPart1: "Once upon a time",
            storyPart2: null,
            storyPart3: null,
            teaId: "tea-1",
            updatedAt: new Date(),
            youtubeURL: null,
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
        createdAt: new Date(),
        dayNumber: 5,
        id: "day-1",
        tea: null,
        updatedAt: new Date(),
        year: 2025,
      };
      dalDayMock.getDay.mockResolvedValue(mockDayNoTea);

      const result = await getStoryTea(5, 2025);
      expect(result).toBeNull();
    });

    it("should return null if tea has no story", async () => {
      const mockDayNoStory: dalDay.DayWithTeaComplete = {
        createdAt: new Date(),
        dayNumber: 5,
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
          name: "Tea",
          reinfuseNumber: null,
          storeName: null,
          story: null,
          teaType: TeaType.GREEN,
          temperature: 80,
          updatedAt: new Date(),
          url: null,
        },
        updatedAt: new Date(),
        year: 2025,
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
        include: { images: { orderBy: { order: "asc" } }, tea: true },
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
        createdAt: new Date(),
        id: "new-story",
        onlyMusic: false,
        storyPart1: "Intro",
        storyPart2: null,
        storyPart3: null,
        tea: { id: "tea-1" } as Tea,
        teaId: "tea-1",
        updatedAt: new Date(),
        youtubeURL: null,
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
        createdAt: new Date(),
        id: "s1",
        onlyMusic: false,
        storyPart1: "Updated",
        storyPart2: null,
        storyPart3: null,
        tea: { id: "t1" } as Tea,
        teaId: "t1",
        updatedAt: new Date(),
        youtubeURL: null,
      };
      prismaMock.storyTea.update.mockResolvedValue(mockUpdated);

      const result = await editStoryTea({ storyPart1: "Updated" }, "s1");
      expect(result.storyPart1).toBe("Updated");
      expect(prismaMock.storyTea.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { storyPart1: "Updated" },
          where: { id: "s1" },
        }),
      );
    });
  });

  describe("deleteStoryTea", () => {
    it("should delete story", async () => {
      const mockDeleted: StoryWithTea = {
        createdAt: new Date(),
        id: "s1",
        onlyMusic: false,
        storyPart1: "Del",
        storyPart2: null,
        storyPart3: null,
        tea: { id: "t1" } as Tea,
        teaId: "t1",
        updatedAt: new Date(),
        youtubeURL: null,
      };
      prismaMock.storyTea.delete.mockResolvedValue(mockDeleted);

      const result = await deleteStoryTea("s1");
      expect(result.id).toBe("s1");
      expect(prismaMock.storyTea.delete).toHaveBeenCalledWith({
        include: { tea: true },
        where: { id: "s1" },
      });
    });
  });
});

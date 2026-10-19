import { beforeAll, describe, expect, it, vi } from "vitest";

import { StoryImage, TeaType } from "@/generated/prisma/client";
import { prismaMock } from "@/lib/__mocks__/prisma";
import {
  addStoryImage,
  deleteStoryImage,
  editStoryImage,
  getAllStoryImages,
  getStoryImage,
  StoryImageWithStory,
} from "@/lib/dal/dal-story-image";
// dal-tea MOCK
import * as dalTea from "@/lib/dal/dal-tea";
vi.mock("@/lib/dal/dal-tea");
const dalTeaMock = vi.mocked(dalTea);

describe("DAL StoryImage", () => {
  beforeAll(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("getStoryImage", () => {
    const mockImage: StoryImage = {
      createdAt: new Date(),
      id: "img-1",
      order: 0,
      publicId: "cloudinary-id",
      storyTeaId: "story-1",
      updatedAt: new Date(),
    };

    it("should get image by ID string", async () => {
      prismaMock.storyImage.findUnique.mockResolvedValue(mockImage);

      const result = await getStoryImage("img-1");

      expect(result).toEqual(mockImage);
      expect(prismaMock.storyImage.findUnique).toHaveBeenCalledWith({
        where: { id: "img-1" },
      });
    });

    it("should throw if image by ID not found", async () => {
      prismaMock.storyImage.findUnique.mockResolvedValue(null);
      await expect(getStoryImage("missing")).rejects.toThrow("No story image found");
    });

    it("should get image by Order/Day/Year", async () => {
      const mockTeaWithStory: dalTea.TeaWithDayAndCompleteStory = {
        addMilk: false,
        canReinfuse: false,
        createdAt: new Date(),
        day: {
          createdAt: new Date(),
          dayNumber: 5,
          id: "day-1",
          updatedAt: new Date(),
          year: 2025,
        },
        dayId: "day-1",
        hasTheine: true,
        id: "tea-1",
        infusionTime: 3,
        ingredients: [],
        moreIndications: null,
        name: "Tea",
        reinfuseNumber: null,
        storeName: null,
        story: {
          createdAt: new Date(),
          id: "story-1",
          images: [mockImage],
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
      };

      dalTeaMock.getTea.mockResolvedValue(mockTeaWithStory);

      const result = await getStoryImage(0, 5, 2025);

      expect(result).toEqual(mockImage);
      expect(dalTeaMock.getTea).toHaveBeenCalledWith(5, 2025);
    });

    it("should throw if tea has no story", async () => {
      const mockTeaNoStory: dalTea.TeaWithDayAndCompleteStory = {
        addMilk: false,
        canReinfuse: false,
        createdAt: new Date(),
        day: { createdAt: new Date(), dayNumber: 5, id: "day-1", updatedAt: new Date(), year: 2025 },
        dayId: "day-1",
        hasTheine: true,
        id: "tea-1",
        infusionTime: 3,
        ingredients: [],
        moreIndications: null,
        name: "Tea",
        reinfuseNumber: null,
        storeName: null,
        story: null,
        teaType: TeaType.GREEN,
        temperature: 80,
        updatedAt: new Date(),
        url: null,
      };

      dalTeaMock.getTea.mockResolvedValue(mockTeaNoStory);

      await expect(getStoryImage(0, 5, 2025)).rejects.toThrow("No story found");
    });
  });

  describe("getAllStoryImages", () => {
    it("should return images ordered ascending", async () => {
      const mockImages: StoryImage[] = [];
      prismaMock.storyImage.findMany.mockResolvedValue(mockImages);

      await getAllStoryImages("story-1");

      expect(prismaMock.storyImage.findMany).toHaveBeenCalledWith({
        orderBy: { order: "asc" },
        where: { storyTeaId: "story-1" },
      });
    });
  });

  describe("addStoryImage", () => {
    const mockTeaResponse: dalTea.TeaWithDayAndCompleteStory = {
      addMilk: false,
      canReinfuse: false,
      createdAt: new Date(),
      day: { createdAt: new Date(), dayNumber: 5, id: "day-1", updatedAt: new Date(), year: 2025 },
      dayId: "day-1",
      hasTheine: true,
      id: "tea-1",
      infusionTime: 3,
      ingredients: [],
      moreIndications: null,
      name: "Tea",
      reinfuseNumber: null,
      storeName: null,
      story: {
        createdAt: new Date(),
        id: "story-1",
        images: [],
        onlyMusic: false,
        storyPart1: "",
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
    };

    const mockCreatedImage: StoryImageWithStory = {
      createdAt: new Date(),
      id: "new-img",
      order: 0,
      publicId: "pid",
      story: mockTeaResponse.story!,
      storyTeaId: "story-1",
      updatedAt: new Date(),
    };

    it("should create image directly connected to storyId", async () => {
      prismaMock.storyTea.findUnique.mockResolvedValue(mockTeaResponse.story);
      prismaMock.storyImage.create.mockResolvedValue(mockCreatedImage);
      prismaMock.storyImage.count.mockResolvedValue(0);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prismaMock.$transaction.mockImplementation((cb: any) => cb(prismaMock));

      const result = await addStoryImage("pid", 0, "story-1");
      expect(result).toEqual(mockCreatedImage);
      expect(prismaMock.storyImage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            order: 0,
            publicId: "pid",
            story: { connect: { id: "story-1" } },
          }),
        }),
      );
    });

    it("should append image to end if order is large", async () => {
      prismaMock.storyTea.findUnique.mockResolvedValue(mockTeaResponse.story);
      prismaMock.storyImage.create.mockResolvedValue(mockCreatedImage);
      prismaMock.storyImage.count.mockResolvedValue(0);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prismaMock.$transaction.mockImplementation((cb: any) => cb(prismaMock));

      await addStoryImage("pid", 10, "story-1");

      expect(prismaMock.storyImage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            order: 0,
            publicId: "pid",
          }),
        }),
      );
      expect(prismaMock.storyImage.updateMany).not.toHaveBeenCalled();
    });

    it("should shift images if inserting in middle", async () => {
      prismaMock.storyTea.findUnique.mockResolvedValue(mockTeaResponse.story);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prismaMock.$transaction.mockImplementation((cb: any) => cb(prismaMock));
      prismaMock.storyImage.count.mockResolvedValue(2);
      prismaMock.storyImage.create.mockResolvedValue(mockCreatedImage);

      await addStoryImage("pid", 0, "story-1");

      expect(prismaMock.storyImage.updateMany).toHaveBeenCalledWith({
        data: { order: { increment: 1 } },
        where: { order: { gte: 0 }, storyTeaId: "story-1" },
      });

      expect(prismaMock.storyImage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ order: 0 }),
        }),
      );
    });
  });

  describe("editStoryImage", () => {
    it("should update image", async () => {
      const mockImg: StoryImage = {
        createdAt: new Date(),
        id: "i1",
        order: 0,
        publicId: "p1",
        storyTeaId: "s1",
        updatedAt: new Date(),
      };
      prismaMock.storyImage.update.mockResolvedValue(mockImg);

      const result = await editStoryImage({ publicId: "new-p1" }, "i1");

      expect(result).toEqual(mockImg);
      expect(prismaMock.storyImage.update).toHaveBeenCalledWith({
        data: { publicId: "new-p1" },
        where: { id: "i1" },
      });
    });
  });

  describe("deleteStoryImage", () => {
    it("should delete image", async () => {
      const mockImg: StoryImage = {
        createdAt: new Date(),
        id: "i1",
        order: 0,
        publicId: "p1",
        storyTeaId: "s1",
        updatedAt: new Date(),
      };
      prismaMock.storyImage.delete.mockResolvedValue(mockImg);

      const result = await deleteStoryImage("i1");

      expect(prismaMock.storyImage.delete).toHaveBeenCalledWith({
        where: { id: "i1" },
      });
      expect(result.id).toBe("i1");
    });
  });
});

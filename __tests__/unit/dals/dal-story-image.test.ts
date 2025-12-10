import { prismaMock } from '@/lib/__mocks__/prisma';
import { describe, expect, it, vi, beforeAll } from 'vitest'
import { StoryImage, TeaType } from "@/generated/prisma/client";
import { getStoryImage, getAllStoryImages, addStoryImage, editStoryImage, deleteStoryImage, StoryImageWithStory } from "@/lib/dal/dal-story-image";

// dal-tea MOCK
import * as dalTea from "@/lib/dal/dal-tea";
vi.mock("@/lib/dal/dal-tea");
const dalTeaMock = vi.mocked(dalTea)

describe("DAL StoryImage", () => {
  beforeAll(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("getStoryImage", () => {
    const mockImage: StoryImage = {
      id: "img-1",
      storyTeaId: "story-1",
      publicId: "cloudinary-id",
      order: 0,
      createdAt: new Date(),
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
        day: {
          id: "day-1",
          dayNumber: 5,
          year: 2025,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
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
          images: [mockImage],
        },
      };

      dalTeaMock.getTea.mockResolvedValue(mockTeaWithStory);

      const result = await getStoryImage(0, 5, 2025);

      expect(result).toEqual(mockImage);
      expect(dalTeaMock.getTea).toHaveBeenCalledWith(5, 2025);
    });

    it("should throw if tea has no story", async () => {
      const mockTeaNoStory: dalTea.TeaWithDayAndCompleteStory = {
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
        day: { id: "day-1", dayNumber: 5, year: 2025, createdAt: new Date(), updatedAt: new Date() },
        story: null,
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
        where: { storyTeaId: "story-1" },
        orderBy: { order: "asc" },
      });
    });
  });

  describe("addStoryImage", () => {
    const mockTeaResponse: dalTea.TeaWithDayAndCompleteStory = {
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
      day: { id: "day-1", dayNumber: 5, year: 2025, createdAt: new Date(), updatedAt: new Date() },
      story: {
        id: "story-1",
        teaId: "tea-1",
        storyPart1: "",
        storyPart2: null,
        storyPart3: null,
        youtubeURL: null,
        onlyMusic: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        images: [],
      },
    };

    const mockCreatedImage: StoryImageWithStory = {
      id: "new-img",
      storyTeaId: "story-1",
      publicId: "pid",
      order: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      story: mockTeaResponse.story!,
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
            story: { connect: { id: "story-1" } }
          }),
        })
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
        })
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
        where: { storyTeaId: "story-1", order: { gte: 0 } },
        data: { order: { increment: 1 } },
      });

      expect(prismaMock.storyImage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ order: 0 }),
        })
      );
    });
  });

  describe("editStoryImage", () => {
    it("should update image", async () => {
      const mockImg: StoryImage = { id: "i1", order: 0, storyTeaId: "s1", publicId: "p1", createdAt: new Date(), updatedAt: new Date() };
      prismaMock.storyImage.update.mockResolvedValue(mockImg);

      const result = await editStoryImage({ publicId: "new-p1" }, "i1");

      expect(result).toEqual(mockImg);
      expect(prismaMock.storyImage.update).toHaveBeenCalledWith({
        where: { id: "i1" },
        data: { publicId: "new-p1" },
      });
    });
  });

  describe("deleteStoryImage", () => {
    it("should delete image", async () => {
      const mockImg: StoryImage = { id: "i1", order: 0, storyTeaId: "s1", publicId: "p1", createdAt: new Date(), updatedAt: new Date() };
      prismaMock.storyImage.delete.mockResolvedValue(mockImg);

      const result = await deleteStoryImage("i1");

      expect(prismaMock.storyImage.delete).toHaveBeenCalledWith({
        where: { id: "i1" },
      });
      expect(result.id).toBe("i1");
    });
  });
});

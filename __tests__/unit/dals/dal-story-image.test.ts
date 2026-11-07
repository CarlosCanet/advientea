import { beforeAll, describe, expect, it, vi } from "vitest";

// dal-tea MOCK
import type { TeaWithDayAndIngredientsAndStoryImages } from "@/lib/dal/dal-tea";

import { TeaType } from "@/generated/prisma/client";
import { prismaMock } from "@/lib/__mocks__/prisma";
import { addStoryImage, StoryImageWithStory } from "@/lib/dal/dal-story-image";

describe("DAL StoryImage", () => {
  beforeAll(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("addStoryImage", () => {
    const mockTeaResponse: TeaWithDayAndIngredientsAndStoryImages = {
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
});

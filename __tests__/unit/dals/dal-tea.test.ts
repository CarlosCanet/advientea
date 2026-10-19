import { describe, expect, it, vi } from "vitest";

import { Day, Role, TeaIngredient, TeaType } from "@/generated/prisma/client";
import { prismaMock } from "@/lib/__mocks__/prisma";
import { DayWithAssignmentAndTeaComplete, DayWithTeaComplete } from "@/lib/dal";
import * as dalDay from "@/lib/dal/dal-day";
import {
  addTea,
  addTeaComplete,
  deleteTea,
  editTea,
  editTeaComplete,
  getAllTeas,
  getTea,
  getUsernameAssignedToTea,
  TeaWithDay,
  TeaWithDayAndCompleteStory,
} from "@/lib/dal/dal-tea";
vi.mock("@/lib/dal/dal-day");
const dalDayMock = vi.mocked(dalDay);

describe("DAL Tea", () => {
  const mockIngredient1: TeaIngredient = {
    createdAt: new Date(),
    id: "i1-cuid",
    name: "ingredient1",
    updatedAt: new Date(),
  };

  const mockIngredient2: TeaIngredient = {
    createdAt: new Date(),
    id: "i2-cuid",
    name: "ingredient2",
    updatedAt: new Date(),
  };

  describe("getTea", () => {
    it("should get tea by CUID id", async () => {
      const mockDay: Day = {
        createdAt: new Date(),
        dayNumber: 1,
        id: "day-cuid",
        updatedAt: new Date(),
        year: 2025,
      };

      const mockTea: TeaWithDayAndCompleteStory = {
        addMilk: false,
        canReinfuse: false,
        createdAt: new Date(),
        day: mockDay,
        dayId: "day-cuid",
        hasTheine: true,
        id: "tea-cuid",
        infusionTime: 3,
        ingredients: [mockIngredient1, mockIngredient2],
        moreIndications: null,
        name: "Test Tea",
        reinfuseNumber: null,
        storeName: null,
        story: null,
        teaType: TeaType.GREEN,
        temperature: 80,
        updatedAt: new Date(),
        url: null,
      };

      prismaMock.tea.findUnique.mockResolvedValue(mockTea);

      const result = await getTea("tea-cuid");

      expect(result).toBeDefined();
      expect(result?.id).toBe("tea-cuid");
      expect(result?.name).toBe("Test Tea");
      expect(result?.day).toBeDefined();
      expect(result?.day?.id).toBe("day-cuid");
      expect(result?.ingredients).toHaveLength(2);
      expect(result?.ingredients[0].name).toBe("ingredient1");
    });

    it("should get tea by dayNumber and year", async () => {
      const mockDay: Day = {
        createdAt: new Date(),
        dayNumber: 1,
        id: "day-cuid",
        updatedAt: new Date(),
        year: 2025,
      };

      const mockTea: TeaWithDayAndCompleteStory = {
        addMilk: false,
        canReinfuse: false,
        createdAt: new Date(),
        day: mockDay,
        dayId: "day-cuid",
        hasTheine: true,
        id: "tea-cuid",
        infusionTime: 3,
        ingredients: [mockIngredient1, mockIngredient2],
        moreIndications: null,
        name: "Test Tea",
        reinfuseNumber: null,
        storeName: null,
        story: null,
        teaType: TeaType.GREEN,
        temperature: 80,
        updatedAt: new Date(),
        url: null,
      };

      dalDayMock.getDay.mockResolvedValue({ ...mockDay, tea: mockTea });
      prismaMock.tea.findUnique.mockResolvedValue(mockTea);

      const result = await getTea(1, 2025);

      expect(result).toBeDefined();
      expect(result?.id).toBe("tea-cuid");
      expect(result?.name).toBe("Test Tea");
      expect(result?.day).toBeDefined();
      expect(result?.day?.id).toBe("day-cuid");
    });

    it("should return null for non-existent CUID", async () => {
      prismaMock.tea.findUnique.mockResolvedValue(null);

      const result = await getTea("non-existent-cuid");

      expect(result).toBeNull();
    });

    it("should include story and images in response", async () => {
      const mockTea: TeaWithDayAndCompleteStory = {
        addMilk: false,
        canReinfuse: true,
        createdAt: new Date(),
        day: {
          createdAt: new Date(),
          dayNumber: 10,
          id: "day-cuid",
          updatedAt: new Date(),
          year: 2025,
        },
        dayId: "day-cuid",
        hasTheine: true,
        id: "tea-cuid",
        infusionTime: 4,
        ingredients: [mockIngredient1, mockIngredient2],
        moreIndications: null,
        name: "Tea with Story",
        reinfuseNumber: null,
        storeName: null,
        story: {
          createdAt: new Date(),
          id: "story-cuid",
          images: [
            {
              createdAt: new Date(),
              id: "image-1",
              order: 0,
              publicId: "image1",
              storyTeaId: "story-cuid",
              updatedAt: new Date(),
            },
            {
              createdAt: new Date(),
              id: "image-2",
              order: 1,
              publicId: "image2",
              storyTeaId: "story-cuid",
              updatedAt: new Date(),
            },
          ],
          onlyMusic: false,
          storyPart1: "Part 1",
          storyPart2: "Part 2",
          storyPart3: "Part 3",
          teaId: "tea-cuid",
          updatedAt: new Date(),
          youtubeURL: null,
        },
        teaType: TeaType.OOLONG,
        temperature: 90,
        updatedAt: new Date(),
        url: null,
      };

      prismaMock.tea.findUnique.mockResolvedValue(mockTea);

      const result = await getTea("tea-cuid");

      expect(result).toBeDefined();
      expect(result?.story).toBeDefined();
      expect(result?.story?.storyPart1).toBe("Part 1");
      expect(result?.story?.images).toHaveLength(2);
      expect(result?.story?.images[0].order).toBe(0);
    });
  });

  describe("getAllTeas", () => {
    it("should return all teas for a specific year", async () => {
      const mockTeas: Array<TeaWithDayAndCompleteStory> = [
        {
          addMilk: false,
          canReinfuse: false,
          createdAt: new Date(),
          day: {
            createdAt: new Date(),
            dayNumber: 1,
            id: "day-1",
            updatedAt: new Date(),
            year: 2025,
          },
          dayId: "day-1",
          hasTheine: true,
          id: "tea-1",
          infusionTime: 3,
          ingredients: [mockIngredient1, mockIngredient2],
          moreIndications: null,
          name: "Tea 2025-1",
          reinfuseNumber: null,
          storeName: null,
          story: null,
          teaType: TeaType.GREEN,
          temperature: 80,
          updatedAt: new Date(),
          url: null,
        },
        {
          addMilk: true,
          canReinfuse: true,
          createdAt: new Date(),
          day: {
            createdAt: new Date(),
            dayNumber: 2,
            id: "day-2",
            updatedAt: new Date(),
            year: 2025,
          },
          dayId: "day-2",
          hasTheine: true,
          id: "tea-2",
          infusionTime: 5,
          ingredients: [],
          moreIndications: null,
          name: "Tea 2025-2",
          reinfuseNumber: 2,
          storeName: null,
          story: null,
          teaType: TeaType.BLACK,
          temperature: 100,
          updatedAt: new Date(),
          url: null,
        },
      ];

      prismaMock.tea.findMany.mockResolvedValue(mockTeas);

      const result = await getAllTeas(2025);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("Tea 2025-1");
      expect(result[1].name).toBe("Tea 2025-2");
    });

    it("should return empty array when no teas exist for year", async () => {
      prismaMock.tea.findMany.mockResolvedValue([]);

      const result = await getAllTeas(2026);

      expect(result).toEqual([]);
    });
  });

  describe("getUsernameAssignedToTea", () => {
    it("should return username when user is assigned to day", async () => {
      const mockDay: DayWithAssignmentAndTeaComplete = {
        assignment: {
          createdAt: new Date(),
          dayId: "day-cuid",
          guestName: null,
          id: "assignment-cuid",
          updatedAt: new Date(),
          user: {
            createdAt: new Date(),
            email: "test@example.com",
            emailVerified: false,
            id: "user-cuid",
            image: null,
            name: "testuser",
            role: Role.USER,
            updatedAt: new Date(),
            username: "testuser",
          },
          userId: "user-cuid",
          year: 2025,
        },
        createdAt: new Date(),
        dayNumber: 1,
        id: "day-cuid",
        tea: null,
        updatedAt: new Date(),
        year: 2025,
      };
      const mockTea: TeaWithDay = {
        addMilk: false,
        canReinfuse: false,
        createdAt: new Date(),
        day: mockDay,
        dayId: "day-cuid",
        hasTheine: true,
        id: "tea-cuid",
        infusionTime: 3,
        ingredients: [mockIngredient1],
        moreIndications: null,
        name: "Test Tea",
        reinfuseNumber: null,
        storeName: null,
        teaType: TeaType.GREEN,
        temperature: 80,
        updatedAt: new Date(),
        url: null,
      };

      prismaMock.tea.findUnique.mockResolvedValue(mockTea);

      const result = await getUsernameAssignedToTea("tea-cuid");

      expect(result).toBe("testuser");
    });

    it("should return guestName when guest is assigned", async () => {
      const mockDay: DayWithAssignmentAndTeaComplete = {
        assignment: {
          createdAt: new Date(),
          dayId: "day-cuid",
          guestName: "Guest User",
          id: "assignment-cuid",
          updatedAt: new Date(),
          user: null,
          userId: null,
          year: 2025,
        },
        createdAt: new Date(),
        dayNumber: 1,
        id: "day-cuid",
        tea: null,
        updatedAt: new Date(),
        year: 2025,
      };

      const mockTea: TeaWithDay = {
        addMilk: false,
        canReinfuse: false,
        createdAt: new Date(),
        day: mockDay,
        dayId: "day-cuid",
        hasTheine: true,
        id: "tea-cuid",
        infusionTime: 3,
        ingredients: [],
        moreIndications: null,
        name: "Test Tea",
        reinfuseNumber: null,
        storeName: null,
        teaType: TeaType.GREEN,
        temperature: 80,
        updatedAt: new Date(),
        url: null,
      };

      prismaMock.tea.findUnique.mockResolvedValue(mockTea);

      const result = await getUsernameAssignedToTea("tea-cuid");

      expect(result).toBe("Guest User");
    });

    it("should return null when no assignment exists", async () => {
      prismaMock.tea.findUnique.mockResolvedValue(null);

      const result = await getUsernameAssignedToTea("tea-cuid");

      expect(result).toBeNull();
    });
  });

  describe("addTea", () => {
    it("should create a new tea successfully", async () => {
      const mockDay: Day = {
        createdAt: new Date(),
        dayNumber: 15,
        id: "day-cuid",
        updatedAt: new Date(),
        year: 2025,
      };

      const mockCreatedTea: TeaWithDay = {
        addMilk: false,
        canReinfuse: true,
        createdAt: new Date(),
        day: mockDay,
        dayId: "day-cuid",
        hasTheine: false,
        id: "new-tea-cuid",
        infusionTime: 2,
        ingredients: [mockIngredient1, mockIngredient2],
        moreIndications: "Handle with care",
        name: "New Tea",
        reinfuseNumber: 3,
        storeName: "Tea Shop",
        teaType: TeaType.WHITE,
        temperature: 70,
        updatedAt: new Date(),
        url: "https://tea.example.com",
      };

      prismaMock.day.findUnique.mockResolvedValue(mockDay);
      prismaMock.tea.create.mockResolvedValue(mockCreatedTea);

      const result = await addTea(
        {
          addMilk: false,
          canReinfuse: true,
          hasTheine: false,
          infusionTime: 2,
          moreIndications: "Handle with care",
          name: "New Tea",
          reinfuseNumber: 3,
          storeName: "Tea Shop",
          teaType: TeaType.WHITE,
          temperature: 70,
          url: "https://tea.example.com",
        },
        ["ingredient1"],
        15,
        2025,
      );

      expect(result?.id).toBe("new-tea-cuid");
      expect(result?.name).toBe("New Tea");
      expect(prismaMock.tea.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            ingredients: {
              connect: [{ id: "ingredient1" }],
            },
            name: "New Tea",
          }),
          include: expect.objectContaining({ ingredients: true }),
        }),
      );
    });

    it("should create a tea without day assignment (Draft)", async () => {
      const mockTea: TeaWithDay = {
        addMilk: false,
        canReinfuse: true,
        createdAt: new Date(),
        day: null,
        dayId: null,
        hasTheine: false,
        id: "new-tea-cuid",
        infusionTime: 2,
        ingredients: [mockIngredient1, mockIngredient2],
        moreIndications: "Handle with care",
        name: "Draft Tea",
        reinfuseNumber: 3,
        storeName: "Tea Shop",
        teaType: TeaType.WHITE,
        temperature: 70,
        updatedAt: new Date(),
        url: "https://tea.example.com",
      };
      prismaMock.tea.create.mockResolvedValue(mockTea);

      const result = await addTea({
        addMilk: false,
        canReinfuse: true,
        hasTheine: false,
        infusionTime: 2,
        moreIndications: "Handle with care",
        name: "Draft Tea",
        reinfuseNumber: 3,
        storeName: "Tea Shop",
        teaType: TeaType.WHITE,
        temperature: 70,
        url: "https://tea.example.com",
      });

      expect(result?.day).toBeNull();
      expect(result?.name).toBe("Draft Tea");
      expect(prismaMock.day.findUnique).not.toHaveBeenCalled();
    });

    it("should throw error if target day is occupied on addTea", async () => {
      const occupiedDay: DayWithTeaComplete = {
        createdAt: new Date(),
        dayNumber: 1,
        id: "day-1",
        tea: {
          addMilk: false,
          canReinfuse: true,
          createdAt: new Date(),
          dayId: "day-1",
          hasTheine: false,
          id: "existing cuid",
          infusionTime: 2,
          moreIndications: "Handle with care",
          name: "Draft Tea",
          reinfuseNumber: 3,
          storeName: "Tea Shop",
          story: null,
          teaType: TeaType.WHITE,
          temperature: 70,
          updatedAt: new Date(),
          url: "https://tea.example.com",
        },
        updatedAt: new Date(),
        year: 2025,
      };
      prismaMock.day.findUnique.mockResolvedValue(occupiedDay);

      await expect(
        addTea(
          {
            addMilk: false,
            canReinfuse: true,
            hasTheine: false,
            infusionTime: 4,
            moreIndications: "Handle with care",
            name: "New Tea",
            reinfuseNumber: 3,
            storeName: "Tea Shop",
            teaType: TeaType.BLACK,
            temperature: 70,
            url: "https://tea.example.com",
          },
          ["ingredient1"],
          1,
        ),
      ).rejects.toThrow("already has a tea assigned");
    });
  });

  describe("addTeaComplete", () => {
    it("should create tea with story and images", async () => {
      const mockDay: Day = {
        createdAt: new Date(),
        dayNumber: 15,
        id: "day-cuid",
        updatedAt: new Date(),
        year: 2025,
      };

      const mockTea: TeaWithDay = {
        addMilk: false,
        canReinfuse: true,
        createdAt: new Date(),
        day: mockDay,
        dayId: "day-cuid",
        hasTheine: true,
        id: "tea-cuid",
        infusionTime: 4,
        ingredients: [mockIngredient1, mockIngredient2],
        moreIndications: null,
        name: "Complete Tea",
        reinfuseNumber: 2,
        storeName: null,
        teaType: TeaType.OOLONG,
        temperature: 90,
        updatedAt: new Date(),
        url: null,
      };

      // Mock getDay function (called internally by addTeaComplete)
      prismaMock.day.findUnique.mockResolvedValue(mockDay);
      prismaMock.tea.create.mockResolvedValue(mockTea);

      const result = await addTeaComplete(
        {
          addMilk: false,
          canReinfuse: true,
          hasTheine: true,
          infusionTime: 4,
          name: "Complete Tea",
          reinfuseNumber: 2,
          teaType: TeaType.OOLONG,
          temperature: 90,
        },
        ["ingredient1", "ingredient2"],
        {
          onlyMusic: true,
          storyPart1: "Story Part 1",
          storyPart2: "Story Part 2",
          storyPart3: "Story Part 3",
          youtubeURL: "https://youtube.com/video",
        },
        [{ order: 0, publicId: "cloudinary-id-1" }],
        15,
        2025,
      );

      expect(result?.name).toBe("Complete Tea");
    });
  });

  describe("editTea", () => {
    const mockCurrentTea: TeaWithDay = {
      addMilk: false,
      canReinfuse: true,
      createdAt: new Date(),
      day: null,
      dayId: "day-cuid",
      hasTheine: false,
      id: "tea-cuid",
      infusionTime: 5,
      ingredients: [],
      moreIndications: "Updated instructions",
      name: "Updated Tea Name",
      reinfuseNumber: 2,
      storeName: "New Store",
      teaType: TeaType.HERBAL,
      temperature: 100,
      updatedAt: new Date(),
      url: "https://newstore.com",
    };
    const mockUpdatedTea: TeaWithDay = {
      addMilk: false,
      canReinfuse: true,
      createdAt: new Date(),
      day: {
        createdAt: new Date(),
        dayNumber: 1,
        id: "day-cuid",
        updatedAt: new Date(),
        year: 2025,
      },
      dayId: "day-cuid",
      hasTheine: false,
      id: "tea-cuid",
      infusionTime: 5,
      ingredients: [mockIngredient1, mockIngredient2],
      moreIndications: "Updated instructions",
      name: "Updated Tea Name",
      reinfuseNumber: 2,
      storeName: "New Store",
      teaType: TeaType.HERBAL,
      temperature: 100,
      updatedAt: new Date(),
      url: "https://newstore.com",
    };

    it("should update tea successfully", async () => {
      prismaMock.tea.findUnique.mockResolvedValue(mockCurrentTea);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prismaMock.$transaction.mockImplementation((cb: any) => cb(prismaMock));
      prismaMock.tea.update.mockResolvedValue(mockUpdatedTea);

      const result = await editTea(
        {
          moreIndications: "Updated instructions",
          name: "Updated Tea Name",
          storeName: "New Store",
          teaType: TeaType.HERBAL,
          url: "https://newstore.com",
        },
        "tea-cuid",
      );

      expect(result?.name).toBe("Updated Tea Name");
      expect(result?.moreIndications).toBe("Updated instructions");
    });

    it("should throw error if target day does not exist on editTea", async () => {
      prismaMock.tea.findUnique.mockResolvedValue(mockCurrentTea);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prismaMock.$transaction.mockImplementation((cb: any) => cb(prismaMock));
      prismaMock.day.findFirst.mockResolvedValue(null);

      await expect(editTea({}, "tea-1", 99)).rejects.toThrow("Day 99/2025 not found");
    });

    it("should update tea ingredients using SET", async () => {
      prismaMock.tea.findUnique.mockResolvedValue(mockCurrentTea);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prismaMock.$transaction.mockImplementation((cb: any) => cb(prismaMock));
      prismaMock.tea.update.mockResolvedValue(mockUpdatedTea);
      await editTea({ ingredientIds: ["ingredient1", "ingredient2"], name: "Updated Tea Name" }, "tea-1");
      expect(prismaMock.tea.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            ingredients: {
              set: [{ id: "ingredient1" }, { id: "ingredient2" }],
            },
            name: "Updated Tea Name",
          }),
          where: { id: "tea-1" },
        }),
      );
    });
  });

  describe("editTeaComplete", () => {
    it("should update tea and story", async () => {
      const mockUpdatedTea = {
        addMilk: false,
        canReinfuse: true,
        createdAt: new Date(),
        day: {
          createdAt: new Date(),
          dayNumber: 1,
          id: "day-cuid",
          updatedAt: new Date(),
          year: 2025,
        },
        dayId: "day-cuid",
        hasTheine: true,
        id: "tea-cuid",
        infusionTime: 3,
        moreIndications: null,
        name: "Updated Tea",
        reinfuseNumber: 3,
        storeName: null,
        story: {
          createdAt: new Date(),
          dayId: "day-cuid",
          id: "story-cuid",
          images: [],
          onlyMusic: false,
          storyPart1: "Updated Part 1",
          storyPart2: "Updated Part 2",
          storyPart3: "Updated Part 3",
          updatedAt: new Date(),
          youtubeURL: "https://youtube.com/new",
        },
        teaType: TeaType.GREEN,
        temperature: 80,
        updatedAt: new Date(),
        url: null,
      };

      prismaMock.tea.update.mockResolvedValue(mockUpdatedTea);

      const result = await editTeaComplete(
        "tea-cuid",
        {
          ingredientIds: ["ingredient1"],
          name: "Updated Tea",
        },
        {
          storyPart1: "Updated Part 1",
          storyPart2: "Updated Part 2",
          storyPart3: "Updated Part 3",
          youtubeURL: "https://youtube.com/new",
        },
        [],
      );

      expect(result.name).toBe("Updated Tea");
      expect(result.story?.storyPart1).toBe("Updated Part 1");
      expect(prismaMock.tea.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            ingredients: {
              set: [{ id: "ingredient1" }],
            },
          }),
        }),
      );
    });
  });

  describe("deleteTea", () => {
    it("should delete tea successfully", async () => {
      const mockDeletedTea = {
        addMilk: false,
        canReinfuse: false,
        createdAt: new Date(),
        day: {
          createdAt: new Date(),
          dayNumber: 1,
          id: "day-cuid",
          updatedAt: new Date(),
          year: 2025,
        },
        dayId: "day-cuid",
        hasTheine: true,
        id: "tea-cuid",
        infusionTime: 3,
        moreIndications: null,
        name: "Deleted Tea",
        reinfuseNumber: null,
        storeName: null,
        teaType: TeaType.GREEN,
        temperature: 80,
        updatedAt: new Date(),
        url: null,
      };

      prismaMock.tea.delete.mockResolvedValue(mockDeletedTea);

      const result = await deleteTea("tea-cuid");

      expect(result.id).toBe("tea-cuid");
    });
  });

  describe("Data validation", () => {
    it("should validate tea type enum", () => {
      const validTypes = [TeaType.BLACK, TeaType.GREEN, TeaType.WHITE, TeaType.OOLONG, TeaType.HERBAL];

      validTypes.forEach((type) => {
        expect(Object.values(TeaType)).toContain(type);
      });
    });
  });

  describe("Multi-year support", () => {
    it("should distinguish teas by year", async () => {
      const teas2025 = [
        {
          addMilk: false,
          canReinfuse: false,
          createdAt: new Date(),
          day: {
            createdAt: new Date(),
            dayNumber: 1,
            id: "day-2025",
            updatedAt: new Date(),
            year: 2025,
          },
          dayId: "day-2025",
          hasTheine: true,
          id: "tea-2025",
          infusionTime: 3,
          moreIndications: null,
          name: "Tea 2025",
          reinfuseNumber: null,
          storeName: null,
          story: null,
          teaType: TeaType.GREEN,
          temperature: 80,
          updatedAt: new Date(),
          url: null,
        },
      ];

      const teas2026 = [
        {
          addMilk: false,
          canReinfuse: false,
          createdAt: new Date(),
          day: {
            createdAt: new Date(),
            dayNumber: 1,
            id: "day-2026",
            updatedAt: new Date(),
            year: 2026,
          },
          dayId: "day-2026",
          hasTheine: true,
          id: "tea-2026",
          infusionTime: 5,
          moreIndications: null,
          name: "Tea 2026",
          reinfuseNumber: null,
          storeName: null,
          story: null,
          teaType: TeaType.BLACK,
          temperature: 100,
          updatedAt: new Date(),
          url: null,
        },
      ];

      prismaMock.tea.findMany.mockResolvedValueOnce(teas2025).mockResolvedValueOnce(teas2026);

      const result2025 = await getAllTeas(2025);
      const result2026 = await getAllTeas(2026);

      expect(result2025[0].name).toBe("Tea 2025");
      expect(result2026[0].name).toBe("Tea 2026");
      expect(result2025[0].day?.year).toBe(2025);
      expect(result2026[0].day?.year).toBe(2026);
    });
  });
});

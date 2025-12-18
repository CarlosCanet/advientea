import { prismaMock } from '@/lib/__mocks__/prisma';
import { describe, expect, it, vi } from 'vitest'
import { Day, Role, TeaIngredient, TeaType } from "@/generated/prisma/client";
import { DayWithAssignmentAndTeaComplete, DayWithTeaComplete } from "@/lib/dal";
import {
  getTea,
  getAllTeas,
  getUsernameAssignedToTea,
  addTea,
  addTeaComplete,
  editTea,
  editTeaComplete,
  deleteTea,
  TeaWithDayAndCompleteStory,
  TeaWithDay,
} from "@/lib/dal/dal-tea";

import * as dalDay from "@/lib/dal/dal-day";
vi.mock("@/lib/dal/dal-day");
const dalDayMock = vi.mocked(dalDay);

describe("DAL Tea", () => {
    const mockIngredient1: TeaIngredient = {
    id: "i1-cuid",
    name: "ingredient1",
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const mockIngredient2: TeaIngredient = {
    id: "i2-cuid",
    name: "ingredient2",
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  describe("getTea", () => {
    it("should get tea by CUID id", async () => {
      const mockDay: Day = {
        id: "day-cuid",
        dayNumber: 1,
        year: 2025,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockTea: TeaWithDayAndCompleteStory = {
        id: "tea-cuid",
        dayId: "day-cuid",
        name: "Test Tea",
        ingredients: [mockIngredient1, mockIngredient2],
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
        day: mockDay,
        story: null,
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
        id: "day-cuid",
        dayNumber: 1,
        year: 2025,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockTea: TeaWithDayAndCompleteStory = {
        id: "tea-cuid",
        dayId: "day-cuid",
        name: "Test Tea",
        ingredients: [mockIngredient1, mockIngredient2],
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
        day: mockDay,
        story: null,
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
        id: "tea-cuid",
        dayId: "day-cuid",
        name: "Tea with Story",
        ingredients: [mockIngredient1, mockIngredient2],
        teaType: TeaType.OOLONG,
        infusionTime: 4,
        temperature: 90,
        hasTheine: true,
        canReinfuse: true,
        reinfuseNumber: null,
        moreIndications: null,
        addMilk: false,
        storeName: null,
        url: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        day: {
          id: "day-cuid",
          dayNumber: 10,
          year: 2025,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        story: {
          id: "story-cuid",
          teaId: "tea-cuid",
          storyPart1: "Part 1",
          storyPart2: "Part 2",
          storyPart3: "Part 3",
          youtubeURL: null,
          onlyMusic: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          images: [
            {
              id: "image-1",
              storyTeaId: "story-cuid",
              publicId: "image1",
              order: 0,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
            {
              id: "image-2",
              storyTeaId: "story-cuid",
              publicId: "image2",
              order: 1,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
        },
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
          id: "tea-1",
          dayId: "day-1",
          name: "Tea 2025-1",
          ingredients: [mockIngredient1, mockIngredient2],
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
            dayNumber: 1,
            year: 2025,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          story: null,
        },
        {
          id: "tea-2",
          dayId: "day-2",
          name: "Tea 2025-2",
          ingredients: [],
          teaType: TeaType.BLACK,
          infusionTime: 5,
          temperature: 100,
          hasTheine: true,
          canReinfuse: true,
          reinfuseNumber: 2,
          moreIndications: null,
          addMilk: true,
          storeName: null,
          url: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          day: {
            id: "day-2",
            dayNumber: 2,
            year: 2025,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          story: null,
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
        id: "day-cuid",
        dayNumber: 1,
        year: 2025,
        createdAt: new Date(),
        updatedAt: new Date(),
        tea: null,
        assignment: {
          id: "assignment-cuid",
          dayId: "day-cuid",
          userId: "user-cuid",
          guestName: null,
          year: 2025,
          createdAt: new Date(),
          updatedAt: new Date(),
          user: {
            id: "user-cuid",
            name: "testuser",
            username: "testuser",
            email: "test@example.com",
            emailVerified: false,
            image: null,
            role: Role.USER,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      };
      const mockTea: TeaWithDay = {
        id: "tea-cuid",
        dayId: "day-cuid",
        name: "Test Tea",
        ingredients: [mockIngredient1],
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
        day: mockDay,
      };

      prismaMock.tea.findUnique.mockResolvedValue(mockTea);

      const result = await getUsernameAssignedToTea("tea-cuid");

      expect(result).toBe("testuser");
    });

    it("should return guestName when guest is assigned", async () => {
      const mockDay: DayWithAssignmentAndTeaComplete = {
        id: "day-cuid",
        dayNumber: 1,
        year: 2025,
        createdAt: new Date(),
        updatedAt: new Date(),
        assignment: {
          id: "assignment-cuid",
          dayId: "day-cuid",
          userId: null,
          guestName: "Guest User",
          year: 2025,
          createdAt: new Date(),
          updatedAt: new Date(),
          user: null,
        },
        tea: null,
      };

      const mockTea: TeaWithDay = {
        id: "tea-cuid",
        dayId: "day-cuid",
        name: "Test Tea",
        ingredients: [],
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
        day: mockDay,
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
        id: "day-cuid",
        dayNumber: 15,
        year: 2025,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockCreatedTea: TeaWithDay = {
        id: "new-tea-cuid",
        dayId: "day-cuid",
        name: "New Tea",
        ingredients: [mockIngredient1, mockIngredient2],
        teaType: TeaType.WHITE,
        infusionTime: 2,
        temperature: 70,
        hasTheine: false,
        canReinfuse: true,
        reinfuseNumber: 3,
        moreIndications: "Handle with care",
        addMilk: false,
        storeName: "Tea Shop",
        url: "https://tea.example.com",
        createdAt: new Date(),
        updatedAt: new Date(),
        day: mockDay,
      };

      prismaMock.day.findUnique.mockResolvedValue(mockDay);
      prismaMock.tea.create.mockResolvedValue(mockCreatedTea);

      const result = await addTea(
        {
          name: "New Tea",
          teaType: TeaType.WHITE,
          infusionTime: 2,
          temperature: 70,
          hasTheine: false,
          canReinfuse: true,
          reinfuseNumber: 3,
          moreIndications: "Handle with care",
          addMilk: false,
          storeName: "Tea Shop",
          url: "https://tea.example.com",
        },
        ["ingredient1"],
        15,
        2025
      );

      expect(result?.id).toBe("new-tea-cuid");
      expect(result?.name).toBe("New Tea");
      expect(prismaMock.tea.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: "New Tea",
            ingredients: {
              connect: [{ id: "ingredient1" }],
            }
          }),
          include: expect.objectContaining({ ingredients: true }),
        })
      );
    });

    it("should create a tea without day assignment (Draft)", async () => {
      const mockTea: TeaWithDay = {
        id: "new-tea-cuid",
        name: "Draft Tea",
        ingredients: [mockIngredient1, mockIngredient2],
        teaType: TeaType.WHITE,
        infusionTime: 2,
        temperature: 70,
        hasTheine: false,
        canReinfuse: true,
        reinfuseNumber: 3,
        moreIndications: "Handle with care",
        addMilk: false,
        storeName: "Tea Shop",
        url: "https://tea.example.com",
        createdAt: new Date(),
        updatedAt: new Date(),
        dayId: null,
        day: null,
      };
      prismaMock.tea.create.mockResolvedValue(mockTea);

      const result = await addTea({
        name: "Draft Tea",
        teaType: TeaType.WHITE,
        infusionTime: 2,
        temperature: 70,
        hasTheine: false,
        canReinfuse: true,
        reinfuseNumber: 3,
        moreIndications: "Handle with care",
        addMilk: false,
        storeName: "Tea Shop",
        url: "https://tea.example.com",
      });

      expect(result?.day).toBeNull();
      expect(result?.name).toBe("Draft Tea");
      expect(prismaMock.day.findUnique).not.toHaveBeenCalled();
    });

    it("should throw error if target day is occupied on addTea", async () => {
      const occupiedDay: DayWithTeaComplete = {
        id: "day-1",
        dayNumber: 1,
        year: 2025,
        createdAt: new Date(),
        updatedAt: new Date(),
        tea: {
          id: "existing cuid",
          name: "Draft Tea",
          teaType: TeaType.WHITE,
          infusionTime: 2,
          temperature: 70,
          hasTheine: false,
          canReinfuse: true,
          reinfuseNumber: 3,
          moreIndications: "Handle with care",
          addMilk: false,
          storeName: "Tea Shop",
          url: "https://tea.example.com",
          createdAt: new Date(),
          updatedAt: new Date(),
          dayId: "day-1",
          story: null,
        },
      };
      prismaMock.day.findUnique.mockResolvedValue(occupiedDay);

      await expect(
        addTea(
          {
            name: "New Tea",
            teaType: TeaType.BLACK,
            infusionTime: 4,
            temperature: 70,
            hasTheine: false,
            canReinfuse: true,
            reinfuseNumber: 3,
            moreIndications: "Handle with care",
            addMilk: false,
            storeName: "Tea Shop",
            url: "https://tea.example.com",
          },
          ["ingredient1"],
          1
        )
      ).rejects.toThrow("already has a tea assigned");
    });
  });

  describe("addTeaComplete", () => {
    it("should create tea with story and images", async () => {
      const mockDay: Day = {
        id: "day-cuid",
        dayNumber: 15,
        year: 2025,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockTea: TeaWithDay = {
        id: "tea-cuid",
        dayId: "day-cuid",
        name: "Complete Tea",
        ingredients: [mockIngredient1, mockIngredient2],
        teaType: TeaType.OOLONG,
        infusionTime: 4,
        temperature: 90,
        hasTheine: true,
        canReinfuse: true,
        reinfuseNumber: 2,
        moreIndications: null,
        addMilk: false,
        storeName: null,
        url: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        day: mockDay,
      };

      // Mock getDay function (called internally by addTeaComplete)
      prismaMock.day.findUnique.mockResolvedValue(mockDay);
      prismaMock.tea.create.mockResolvedValue(mockTea);

      const result = await addTeaComplete(
        {
          name: "Complete Tea",
          teaType: TeaType.OOLONG,
          infusionTime: 4,
          temperature: 90,
          hasTheine: true,
          canReinfuse: true,
          reinfuseNumber: 2,
          addMilk: false,
        },
        ["ingredient1", "ingredient2"],
        {
          storyPart1: "Story Part 1",
          storyPart2: "Story Part 2",
          storyPart3: "Story Part 3",
          youtubeURL: "https://youtube.com/video",
          onlyMusic: true,
        },
        [{ publicId: "cloudinary-id-1", order: 0 }],
        15,
        2025
      );

      expect(result?.name).toBe("Complete Tea");
    });
  });

  describe("editTea", () => {
    const mockCurrentTea: TeaWithDay = {
      id: "tea-cuid",
      dayId: "day-cuid",
      name: "Updated Tea Name",
      ingredients: [],
      teaType: TeaType.HERBAL,
      infusionTime: 5,
      temperature: 100,
      hasTheine: false,
      canReinfuse: true,
      reinfuseNumber: 2,
      moreIndications: "Updated instructions",
      addMilk: false,
      storeName: "New Store",
      url: "https://newstore.com",
      day: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const mockUpdatedTea: TeaWithDay = {
      id: "tea-cuid",
      dayId: "day-cuid",
      name: "Updated Tea Name",
      ingredients: [mockIngredient1, mockIngredient2],
      teaType: TeaType.HERBAL,
      infusionTime: 5,
      temperature: 100,
      hasTheine: false,
      canReinfuse: true,
      reinfuseNumber: 2,
      moreIndications: "Updated instructions",
      addMilk: false,
      storeName: "New Store",
      url: "https://newstore.com",
      createdAt: new Date(),
      updatedAt: new Date(),
      day: {
        id: "day-cuid",
        dayNumber: 1,
        year: 2025,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };  

    it("should update tea successfully", async () => {
      prismaMock.tea.findUnique.mockResolvedValue(mockCurrentTea);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prismaMock.$transaction.mockImplementation((cb: any) => cb(prismaMock));
      prismaMock.tea.update.mockResolvedValue(mockUpdatedTea);

      const result = await editTea(
        {
          name: "Updated Tea Name",
          teaType: TeaType.HERBAL,
          moreIndications: "Updated instructions",
          storeName: "New Store",
          url: "https://newstore.com",
        },
        "tea-cuid"
      );

      expect(result?.name).toBe("Updated Tea Name");
      expect(result?.moreIndications).toBe("Updated instructions");
    });

    it("should throw error if target day does not exist on editTea", async () => {
      prismaMock.tea.findUnique.mockResolvedValue((mockCurrentTea));
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
      await editTea({ name: "Updated Tea Name", ingredientIds: ["ingredient1", "ingredient2"] }, "tea-1");
      expect(prismaMock.tea.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "tea-1" },
          data: expect.objectContaining({
            name: "Updated Tea Name",
            ingredients: {
              set: [
                { id: "ingredient1" },
                { id: "ingredient2" }
              ], 
            },
          }),
        })
      );
    });
  });

  describe("editTeaComplete", () => {
    it("should update tea and story", async () => {
      const mockUpdatedTea = {
        id: "tea-cuid",
        dayId: "day-cuid",
        name: "Updated Tea",
        teaType: TeaType.GREEN,
        infusionTime: 3,
        temperature: 80,
        hasTheine: true,
        canReinfuse: true,
        reinfuseNumber: 3,
        moreIndications: null,
        addMilk: false,
        storeName: null,
        url: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        day: {
          id: "day-cuid",
          dayNumber: 1,
          year: 2025,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        story: {
          id: "story-cuid",
          dayId: "day-cuid",
          storyPart1: "Updated Part 1",
          storyPart2: "Updated Part 2",
          storyPart3: "Updated Part 3",
          youtubeURL: "https://youtube.com/new",
          onlyMusic: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          images: [],
        },
      };

      prismaMock.tea.update.mockResolvedValue(mockUpdatedTea);

      const result = await editTeaComplete(
        "tea-cuid",
        {
          name: "Updated Tea",
          ingredientIds: ["ingredient1"]
        },
        {
          storyPart1: "Updated Part 1",
          storyPart2: "Updated Part 2",
          storyPart3: "Updated Part 3",
          youtubeURL: "https://youtube.com/new",
        },
        []
      );

      expect(result.name).toBe("Updated Tea");
      expect(result.story?.storyPart1).toBe("Updated Part 1");
      expect(prismaMock.tea.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            ingredients: {
              set: [{ id: "ingredient1" }]
            }
          })
        })
      );
    });
  });

  describe("deleteTea", () => {
    it("should delete tea successfully", async () => {
      const mockDeletedTea = {
        id: "tea-cuid",
        dayId: "day-cuid",
        name: "Deleted Tea",
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
          id: "day-cuid",
          dayNumber: 1,
          year: 2025,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
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
          id: "tea-2025",
          dayId: "day-2025",
          name: "Tea 2025",
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
            id: "day-2025",
            dayNumber: 1,
            year: 2025,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          story: null,
        },
      ];

      const teas2026 = [
        {
          id: "tea-2026",
          dayId: "day-2026",
          name: "Tea 2026",
          teaType: TeaType.BLACK,
          infusionTime: 5,
          temperature: 100,
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
            id: "day-2026",
            dayNumber: 1,
            year: 2026,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          story: null,
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

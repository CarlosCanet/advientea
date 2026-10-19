import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TeaIngredient } from "@/generated/prisma/client";
import { TeaType } from "@/generated/prisma/enums";
import { DayForGuessing, getDayForGuessing } from "@/lib/dal";
import {
  calculatePointsFromGuess,
  canUserGuessPerson,
  canUserGuessTea,
  validateTeaGuess,
} from "@/lib/services/tea-guess-service";
import { TeaGuessFormData } from "@/lib/types";

vi.mock("@/lib/dal", () => ({
  getDayForGuessing: vi.fn(),
}));

function createMockFormData(data: TeaGuessFormData): FormData {
  const formData = new FormData();
  if (data.teaName) formData.append("teaName", data.teaName);
  if (data.personName) formData.append("personName", data.personName);
  if (data.teaType) formData.append("teaType", data.teaType);
  if (Array.isArray(data.ingredients)) {
    data.ingredients.forEach((ingredient, index) => formData.append(`ingredient-${index}`, ingredient));
  }
  return formData;
}

describe("Tea service", () => {
  describe("validateTeaGuess (Form validation)", () => {
    it.each([
      {
        data: {
          ingredients: ["Ingre1", "Ingredient2"],
          personName: "Person",
          teaName: "My tea",
          teaType: TeaType.BLACK,
        },
        name: "Full data",
      },
      { data: { ingredients: ["Ingre1", "Ingredient2"] }, name: "Only ingredients" },
      { data: { teaName: "My tea" }, name: "Only Tea Name" },
      { data: { personName: "Person" }, name: "Only Person Name" },
      { data: { teaType: TeaType.BLACK }, name: "Only Tea Type" },
    ])("should return true for valid data", ({ data }) => {
      const formData = createMockFormData(data);
      expect(validateTeaGuess(formData).success).toBe(true);
    });

    it.each([
      { data: { teaName: "" }, name: "Only one empty field" },
      { data: { personName: "   " }, name: "Only blank spaces" },
      { data: { ingredients: [] }, name: "Empty array" },
    ])("should return false for empty string or empty arrays", ({ data }) => {
      const formData = createMockFormData(data);
      expect(validateTeaGuess(formData).success).toBe(false);
    });
  });

  describe("Business logic rules", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.resetAllMocks();
    });
    afterAll(() => {
      vi.useRealTimers();
    });

    const mockGuessInDB = (
      userId: null | string,
      dayNumber: number,
      year: number = 2025,
      teaExists: boolean = true,
    ) => {
      vi.mocked(getDayForGuessing).mockResolvedValue({
        assignment: {
          guestName: userId ? "" : "Anónimo",
          user: userId
            ? {
                id: userId,
                username: "",
              }
            : null,
        },
        dayNumber,
        tea: teaExists
          ? {
              ingredients: [],
              name: "",
              teaType: TeaType.BLACK,
            }
          : null,
        year,
      });
    };

    describe("canUserGuessTea", () => {
      describe("Data integrity", () => {
        it("should return false if the tea doesn't exist for that day", async () => {
          mockGuessInDB("user-owner", 5, 2025, false);
          const simulatedNow = new Date(2025, 11, 5, 11, 0, 0);
          vi.setSystemTime(simulatedNow);
          const result = await canUserGuessTea("day-5", "user-player");
          expect(result).toBe(false);
        });

        it("should return false if the day doesn't exist yet", async () => {
          vi.mocked(getDayForGuessing).mockResolvedValue(null);
          const simulatedNow = new Date(2025, 11, 5, 11, 0, 0);
          vi.setSystemTime(simulatedNow);
          const result = await canUserGuessTea("day-999", "user-player");
          expect(result).toBe(false);
        });
      });

      describe("Identity constraints. Who can guess? (at the right time)", () => {
        it("should return true if the user is not the owner", async () => {
          mockGuessInDB("user-owner", 5);
          const simulatedNow = new Date(2025, 11, 5, 11, 0, 0);
          vi.setSystemTime(simulatedNow);
          const result = await canUserGuessTea("day-5", "user-player");
          expect(result).toBe(true);
        });

        it("should return true if the assignment is anonymous", async () => {
          mockGuessInDB(null, 5);
          const simulatedNow = new Date(2025, 11, 5, 11, 0, 0);
          vi.setSystemTime(simulatedNow);
          const result = await canUserGuessTea("day-5", "user-player");
          expect(result).toBe(true);
        });

        it("should return false if the user is the owner", async () => {
          mockGuessInDB("user-owner", 5);
          const simulatedNow = new Date(2025, 11, 5, 11, 0, 0);
          vi.setSystemTime(simulatedNow);
          const result = await canUserGuessTea("day-5", "user-owner");
          expect(result).toBe(false);
        });
      });

      describe("Time constraints. When can they guess? (with the right user)", () => {
        it("should return true if today is the target day and BEFORE tea revelation time", async () => {
          mockGuessInDB("user-owner", 5);
          const simulatedNow = new Date(2025, 11, 5, 11, 0, 0);
          vi.setSystemTime(simulatedNow);
          const result = await canUserGuessTea("day-5", "user-player");
          expect(result).toBe(true);
        });

        it("should return false if today is the target day and AFTER tea revelation time", async () => {
          mockGuessInDB("user-owner", 5);
          const simulatedNow = new Date(2025, 11, 5, 20, 1, 0);
          vi.setSystemTime(simulatedNow);
          const result = await canUserGuessTea("day-5", "user-player");
          expect(result).toBe(false);
        });

        it("should return false if the target day is in the past", async () => {
          mockGuessInDB("user-owner", 5);
          const simulatedNow = new Date(2025, 11, 6, 2, 0, 0);
          vi.setSystemTime(simulatedNow);
          const result = await canUserGuessTea("day-5", "user-player");
          expect(result).toBe(false);
        });

        it("should return false when the target day is in the future", async () => {
          mockGuessInDB("user-owner", 5);
          const simulatedNow = new Date(2025, 11, 1, 11, 0, 0);
          vi.setSystemTime(simulatedNow);
          const result = await canUserGuessTea("day-5", "user-player");
          expect(result).toBe(false);
        });
      });
    });

    describe("canUserGuessPerson", () => {
      describe("Data integrity", () => {
        it("should return false if the user is not the owner but the tea doesn't exist", async () => {
          mockGuessInDB("user-owner", 5, 2025, false);
          const simulatedNow = new Date(2025, 11, 5, 11, 0, 0);
          vi.setSystemTime(simulatedNow);
          const result = await canUserGuessPerson("day-5", "user-owner");
          expect(result).toBe(false);
        });

        it("should return false if the day doesn't exist", async () => {
          vi.mocked(getDayForGuessing).mockResolvedValue(null);
          const simulatedNow = new Date(2025, 11, 5, 11, 0, 0);
          vi.setSystemTime(simulatedNow);
          const result = await canUserGuessPerson("day-5", "user-owner");
          expect(result).toBe(false);
        });
      });

      describe("Identity constraints. Who can guess? (at the right time)", () => {
        it("should return true if the user is not the owner", async () => {
          mockGuessInDB("user-owner", 5);
          const simulatedNow = new Date(2025, 11, 5, 11, 0, 0);
          vi.setSystemTime(simulatedNow);
          const result = await canUserGuessPerson("day-5", "user-player");
          expect(result).toBe(true);
        });

        it("should return true if the assignment is anonymous", async () => {
          mockGuessInDB(null, 5);
          const simulatedNow = new Date(2025, 11, 5, 11, 0, 0);
          vi.setSystemTime(simulatedNow);
          const result = await canUserGuessPerson("day-5", "user-player");
          expect(result).toBe(true);
        });

        it("should return false if the user is the owner", async () => {
          mockGuessInDB("user-owner", 5);
          const simulatedNow = new Date(2025, 11, 5, 11, 0, 0);
          vi.setSystemTime(simulatedNow);
          const result = await canUserGuessPerson("day-5", "user-owner");
          expect(result).toBe(false);
        });
      });

      describe("Time constraints. When can they guess? (with the right user)", () => {
        it("should return true if today is the target day and current time is BEFORE the revelation deadline", async () => {
          mockGuessInDB("user-owner", 5);
          const simulatedNow = new Date(2025, 11, 5, 11, 0, 0);
          vi.setSystemTime(simulatedNow);
          const result = await canUserGuessPerson("day-5", "user-player");
          expect(result).toBe(true);
        });

        it("should return false if today is the target day but current time is AFTER the revelation deadline", async () => {
          mockGuessInDB("user-owner", 21);
          const simulatedNow = new Date(2025, 11, 21, 20, 1, 0);
          vi.setSystemTime(simulatedNow);
          const result = await canUserGuessPerson("day-21", "user-player");
          expect(result).toBe(false);
        });

        it("should return true if the target day is in the past but current time is still BEFORE the revelation deadline", async () => {
          mockGuessInDB("user-owner", 5);
          const simulatedNow = new Date(2025, 11, 6, 2, 0, 0);
          vi.setSystemTime(simulatedNow);
          const result = await canUserGuessPerson("day-5", "user-player");
          expect(result).toBe(true);
        });

        it("should return false if the target day is in the past and current time is AFTER the revelation deadline", async () => {
          mockGuessInDB("user-owner", 5);
          const simulatedNow = new Date(2025, 11, 21, 20, 1, 0);
          vi.setSystemTime(simulatedNow);
          const result = await canUserGuessPerson("day-5", "user-player");
          expect(result).toBe(false);
        });

        it("should return false when the target day is in the future", async () => {
          mockGuessInDB("user-owner", 5);
          const simulatedNow = new Date(2025, 11, 1, 11, 0, 0);
          vi.setSystemTime(simulatedNow);
          const result = await canUserGuessPerson("day-5", "user-player");
          expect(result).toBe(false);
        });
      });
    });

    describe("calculatePointsFromGuess", () => {
      const TEST_DATE = new Date("2025-12-05T10:00:00Z");
      beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(TEST_DATE);
      });
      afterEach(() => {
        vi.resetAllMocks();
        vi.useRealTimers();
      });

      const mockIngredient1: TeaIngredient = {
        createdAt: new Date(),
        id: "i1-id",
        name: "ingredient1",
        updatedAt: new Date(),
      };

      const mockDayData: DayForGuessing = {
        assignment: {
          guestName: null,
          user: { id: "user-id", username: "userName" },
        },
        dayNumber: 1,
        tea: {
          ingredients: [mockIngredient1],
          name: "Earl Grey",
          teaType: TeaType.BLACK,
        },
        year: 2025,
      };

      const mockUserGuess = {
        ingredients: ["i1-id"],
        personName: "user1-id",
        personType: "userId" as const,
        teaName: "Earl Grey",
        teaType: TeaType.BLACK,
      };

      it("should return null if the day or tea does not exist", async () => {
        vi.mocked(getDayForGuessing).mockResolvedValue(null);
        const result1 = await calculatePointsFromGuess("day999-id", mockUserGuess);
        vi.mocked(getDayForGuessing).mockResolvedValue({ assignment: null, dayNumber: 2, tea: null, year: 2025 });
        const result2 = await calculatePointsFromGuess("day2-id", mockUserGuess);
        expect(result1).toBeNull();
        expect(result2).toBeNull();
      });

      it("should calculate points when day and tea exist", async () => {
        vi.mocked(getDayForGuessing).mockResolvedValue(mockDayData);
        const result = await calculatePointsFromGuess("day1-id", mockUserGuess);
        expect(result).toBeTypeOf("number");
        expect(result).toBeGreaterThan(0);
        expect(getDayForGuessing).toHaveBeenCalledWith("day1-id");
      });
    });
  });
});

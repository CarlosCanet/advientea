import { TeaIngredient } from "@/generated/prisma/client";
import { TeaType } from "@/generated/prisma/enums";
import { DayForGuessing, getDayForGuessing } from "@/lib/dal";
import { calculatePointsFromGuess, canUserGuessPerson, canUserGuessTea, validateTeaGuess } from "@/lib/services/tea-guess-service";
import { TeaGuessFormData } from "@/lib/types";
import { it, expect, describe, vi, afterEach, afterAll, beforeEach } from "vitest";

vi.mock("@/lib/dal", () => ({
  getDayForGuessing: vi.fn(),
}));

function createMockFormData(data: TeaGuessFormData): FormData {
  const formData = new FormData();
  if (data.teaName) formData.append("teaName", data.teaName);
  if (data.personName) formData.append("personName", data.personName);
  if (data.personType) formData.append("personType", data.personType);
  if (data.teaType) formData.append("teaType", data.teaType);
  if (Array.isArray(data.ingredients)) {
    data.ingredients.forEach((ingredient, index) => formData.append(`ingredient-${index}`, ingredient));
  }
  return formData;
}

describe("Tea service", () => {
  describe("validateTeaGuess (Form validation)", () => {
    it.each([
      { name: "Full data", data: { ingredients: ["Ingre1", "Ingredient2"], teaName: "My tea", personName: "Person", personType: "userId" as const, teaType: TeaType.BLACK } },
      { name: "Only ingredients", data: { ingredients: ["Ingre1", "Ingredient2"] } },
      { name: "Only Tea Name", data: { teaName: "My tea" } },
      { name: "Only Person Name", data: { personName: "Person", personType: "userId" as const } },
      { name: "Only Tea Type", data: { teaType: TeaType.BLACK } },
    ])("should return true for valid data", ({ data }) => {
      const formData = createMockFormData(data);
      expect(validateTeaGuess(formData).success).toBe(true);
    });

    it.each([
      { name: "Only one empty field", data: { teaName: "" } },
      { name: "Only blank spaces", data: { personName: "   " } },
      { name: "Empty array", data: { ingredients: [] } },
    ])("should return false for empty string or empty arrays", ({ data }) => {
      const formData = createMockFormData(data);
      expect(validateTeaGuess(formData).success).toBe(false);
    });

    it("should return false if personType field is missing", () => {
      const data: TeaGuessFormData = {
        personName: "user",
      }
      const formData = createMockFormData(data);
      expect(validateTeaGuess(formData).success).toBe(false);
    });
  });

  describe("Business logic rules", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    })
    afterEach(() => {
      vi.resetAllMocks();
    });
    afterAll(() => {
      vi.useRealTimers();
    });

    const mockGuessInDB = (userId: string | null, dayNumber: number, year: number = 2025, teaExists: boolean = true) => {
      vi.mocked(getDayForGuessing).mockResolvedValue({
        dayNumber,
        year,
        assignment: {
          user: userId
            ? {
              id: userId,
              username: "",
            }
            : null,
          guestName: userId ? "" : "Anónimo",
        },
        tea: teaExists
          ? {
            name: "",
            ingredients: [],
            teaType: TeaType.BLACK,
          }
          : null,
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
      })

      describe("Identity constraints. Who can guess? (at the right time)", () => {
        it("should return true if the user is not the owner", async () => {
          mockGuessInDB("user-owner", 5);
          const simulatedNow = new Date(2025, 11, 5, 11, 0, 0);
          vi.setSystemTime(simulatedNow);
          const result = await canUserGuessTea("day-5", "user-player");
          expect(result).toBe(true);
        })

        it("should return true if the assignment is anonymous", async () => {
          mockGuessInDB(null, 5);
          const simulatedNow = new Date(2025, 11, 5, 11, 0, 0);
          vi.setSystemTime(simulatedNow);
          const result = await canUserGuessTea("day-5", "user-player");
          expect(result).toBe(true);
        })

        it("should return false if the user is the owner", async () => {
          mockGuessInDB("user-owner", 5);
          const simulatedNow = new Date(2025, 11, 5, 11, 0, 0);
          vi.setSystemTime(simulatedNow);
          const result = await canUserGuessTea("day-5", "user-owner");
          expect(result).toBe(false);
        })
      })

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
        })

        it("should return false if the day doesn't exist", async () => {
          vi.mocked(getDayForGuessing).mockResolvedValue(null);
          const simulatedNow = new Date(2025, 11, 5, 11, 0, 0);
          vi.setSystemTime(simulatedNow);
          const result = await canUserGuessPerson("day-5", "user-owner");
          expect(result).toBe(false);
        })
      })

      describe("Identity constraints. Who can guess? (at the right time)", () => {
        it("should return true if the user is not the owner", async () => {
          mockGuessInDB("user-owner", 5);
          const simulatedNow = new Date(2025, 11, 5, 11, 0, 0);
          vi.setSystemTime(simulatedNow);
          const result = await canUserGuessPerson("day-5", "user-player");
          expect(result).toBe(true);
        })

        it("should return true if the assignment is anonymous", async () => {
          mockGuessInDB(null, 5);
          const simulatedNow = new Date(2025, 11, 5, 11, 0, 0);
          vi.setSystemTime(simulatedNow);
          const result = await canUserGuessPerson("day-5", "user-player");
          expect(result).toBe(true);
        })

        it("should return false if the user is the owner", async () => {
          mockGuessInDB("user-owner", 5);
          const simulatedNow = new Date(2025, 11, 5, 11, 0, 0);
          vi.setSystemTime(simulatedNow);
          const result = await canUserGuessPerson("day-5", "user-owner");
          expect(result).toBe(false);
        })
      })

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
      })
      afterEach(() => {
        vi.resetAllMocks();
        vi.useRealTimers();
      });

      const mockIngredient1: TeaIngredient = {
        id: "i1-id",
        name: "ingredient1",
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const mockDayData: DayForGuessing = {
        dayNumber: 1,
        year: 2025,
        tea: {
          name: "Earl Grey",
          teaType: TeaType.BLACK,
          ingredients: [mockIngredient1],
        },
        assignment: {
          user: { id: "user-id", username: "userName" },
          guestName: null,
        },
      };

      const mockUserGuess = {
        teaName: "Earl Grey",
        teaType: TeaType.BLACK,
        ingredients: ["i1-id"],
        personName: "user1-id",
        personType: "userId" as const,
      };

      it("should return null if the day or tea does not exist", async () => {
        vi.mocked(getDayForGuessing).mockResolvedValue(null);
        const result1 = await calculatePointsFromGuess("day999-id", mockUserGuess);
        vi.mocked(getDayForGuessing).mockResolvedValue({ dayNumber: 2, year: 2025, assignment: null, tea: null });
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

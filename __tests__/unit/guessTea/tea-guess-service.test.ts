import { TeaType } from "@/generated/prisma/enums";
import { getDayForGuessing } from "@/lib/dal";
import { canUserGuessPerson, canUserGuessTea, validateTeaGuess } from "@/lib/services/tea-guess-service";
import { TeaGuessFormData } from "@/lib/types";
import { it, expect, describe, vi, afterEach, afterAll, beforeEach } from "vitest";

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
      { name: "Full data", data: { ingredients: ["Ingre1", "Ingredient2"], teaName: "My tea", personaName: "Person", teaType: TeaType.BLACK } },
      { name: "Only ingredients", data: { ingredients: ["Ingre1", "Ingredient2"] } },
      { name: "Only Tea Name", data: { teaName: "My tea" } },
      { name: "Only Persona Name", data: { personName: "Person" } },
      { name: "Only Tea Type", data: { teaType: TeaType.BLACK } },
    ])("should return true for valid data", ({ data }) => {
      const formData = createMockFormData(data);
      expect(validateTeaGuess(formData).success).toBe(true);
    });

    it.each([
      { name: "Only one empty field", data: { teaName: "" } },
      { name: "Only blank spaces", data: { personaName: "   " } },
      { name: "Empty array", data: { ingredients: [] } },
    ])("should return false for empty string or empty arrays", ({ data }) => {
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
          const result = await canUserGuessPerson("day-5", "user-player");
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
  })
});

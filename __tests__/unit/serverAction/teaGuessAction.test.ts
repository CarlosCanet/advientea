import { it, expect, describe, vi, beforeAll, beforeEach } from "vitest";
import { auth } from "@/lib/auth";
import { submitTeaGuess } from "@/app/actions/teaGuessActions";
import { Role, TeaType } from "@/generated/prisma/enums";
import { createTeaGuess, TeaGuessWithIngredients } from "@/lib/dal";
import { TeaIngredient } from "@/generated/prisma/client";
import { calculatePointsFromGuess, canUserGuessPerson, canUserGuessTea, validateTeaGuess } from "@/lib/services/tea-guess-service";
import { revalidatePath } from "next/cache";

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue({}),
}));
vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));
vi.mock("@/lib/dal", () => ({
  createTeaGuess: vi.fn(),
}));
vi.mock("@/lib/services/tea-guess-service", () => ({
  canUserGuessTea: vi.fn(),
  canUserGuessPerson: vi.fn(),
  validateTeaGuess: vi.fn(),
  calculatePointsFromGuess: vi.fn()
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("teaGuessAction", () => {
  const validFormData: FormData = new FormData();
  const invalidFormData: FormData = new FormData();
  const validSession = {
    session: {
      id: "session-id",
      createdAt: new Date(),
      updatedAt: new Date(),
      userId: "user-id",
      expiresAt: new Date(),
      token: "token",
    },
    user: {
      id: "user-id",
      createdAt: new Date(),
      updatedAt: new Date(),
      email: "email@email.com",
      emailVerified: false,
      name: "user-name",
      username: "user-name",
      role: Role.USER,
    },
  };
  const mockIngredient1: TeaIngredient = {
    id: "i1-id",
    name: "ingredient1-id",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const mockIngredient2: TeaIngredient = {
    id: "i2-id",
    name: "ingredient2-id",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const mockTeaGuessCreated: TeaGuessWithIngredients = {
    id: "guess-id",
    userId: "user-id",
    dayId: "day-id",
    guessedTeaName: "teaname",
    guessedTeaType: TeaType.GREEN,
    guessedIngredients: [mockIngredient1, mockIngredient2],
    guessedUserId: "user2-id",
    guessedGuestName: null,
    points: 800,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  beforeAll(() => {
    validFormData.append("teaName", "teaname");
    validFormData.append("teaType", "GREEN");
    validFormData.append("ingredient-1", "ingredient1-id");
    validFormData.append("ingredient-2", "ingredient2-id");
    validFormData.append("personName", "user2-id");
    validFormData.append("personType", "userId");
  });
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it("should return error if user is not authenticated", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null);
    const result = await submitTeaGuess("day-id", null, validFormData);
    expect(result.success).toBe(false);
    expect(result.message).toBe("Unauthorized");
    expect(createTeaGuess).not.toHaveBeenCalled();
  });

  it("should return validation errors for invalid data", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(validSession);
    vi.mocked(validateTeaGuess).mockResolvedValue({
      success: false,
      error: { errors: ["error"], properties: { teaName: { errors: ["value"] } } },
      inputs: { ingredients: [], personName: "", personType: "", teaName: "", teaType: "" },
    });
    const result = await submitTeaGuess("day-id", null, invalidFormData);
    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(createTeaGuess).not.toHaveBeenCalled();
  });

  it("should return error if user is the owner of the tea or wrong date", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(validSession);
    vi.mocked(validateTeaGuess).mockResolvedValue({
      success: true,
      data: {
        teaName: "teaname",
        personName: "user2-id",
        personType: "userId",
        teaType: TeaType.GREEN,
        ingredients: [mockIngredient1.id, mockIngredient2.id],
      },
    });
    vi.mocked(canUserGuessPerson).mockResolvedValue(false);
    const result1 = await submitTeaGuess("day-id", null, validFormData);
    expect(result1.success).toBe(false);
    expect(createTeaGuess).not.toHaveBeenCalled();
    vi.mocked(canUserGuessPerson).mockResolvedValue(true);
    vi.mocked(canUserGuessTea).mockResolvedValue(false);
    const result2 = await submitTeaGuess("day-id", null, validFormData);
    expect(result2.success).toBe(false);
    expect(createTeaGuess).not.toHaveBeenCalled();
  });

  it("should return success if user is authenticated and valid data", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(validSession);
    vi.mocked(createTeaGuess).mockResolvedValue(mockTeaGuessCreated);
    vi.mocked(validateTeaGuess).mockResolvedValue({
      success: true,
      data: {
        teaName: "teaname",
        personName: "user2-id",
        personType: "userId",
        teaType: TeaType.GREEN,
        ingredients: [mockIngredient1.id, mockIngredient2.id],
      },
    });
    vi.mocked(canUserGuessPerson).mockResolvedValue(true);
    vi.mocked(canUserGuessTea).mockResolvedValue(true);
    vi.mocked(calculatePointsFromGuess).mockResolvedValue(200);
    const result = await submitTeaGuess("day-id", null, validFormData);
    expect(result.success).toBe(true);
    expect(createTeaGuess).toHaveBeenCalledWith(
      "user-id",
      "day-id",
      expect.objectContaining({
        teaName: "teaname",
        teaType: TeaType.GREEN,
        ingredients: ["i1-id", "i2-id"],
        personName: "user2-id",
        personType: "userId",
      }),
      expect.anything()
    );
    expect(revalidatePath).toHaveBeenCalledWith("/teaDay");
  });
});

import { revalidatePath } from "next/cache";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { submitTeaGuess } from "@/app/actions/teaGuessActions";
import { TeaIngredient } from "@/generated/prisma/client";
import { Role, TeaType } from "@/generated/prisma/enums";
import { createTeaGuess, requireSession, TeaGuessWithIngredients } from "@/lib/dal";
import { UnauthenticatedError } from "@/lib/errors";
import {
  calculatePointsFromGuess,
  canUserGuessPerson,
  canUserGuessTea,
  validateTeaGuess,
} from "@/lib/services/tea-guess-service";

vi.mock("@/lib/dal", () => ({
  createTeaGuess: vi.fn(),
  requireSession: vi.fn(),
}));
vi.mock("@/lib/services/tea-guess-service", () => ({
  calculatePointsFromGuess: vi.fn(),
  canUserGuessPerson: vi.fn(),
  canUserGuessTea: vi.fn(),
  validateTeaGuess: vi.fn(),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("teaGuessAction", () => {
  const validFormData: FormData = new FormData();
  const invalidFormData: FormData = new FormData();
  const authenticatedSession = {
    isAuth: true as const,
    role: Role.USER,
    user: {
      createdAt: new Date(),
      email: "email@email.com",
      emailVerified: false,
      id: "user-id",
      name: "user-name",
      role: Role.USER,
      updatedAt: new Date(),
      username: "user-name",
    },
    userId: "user-id",
  };
  const mockIngredient1: TeaIngredient = {
    createdAt: new Date(),
    id: "i1-id",
    name: "ingredient1-id",
    updatedAt: new Date(),
  };
  const mockIngredient2: TeaIngredient = {
    createdAt: new Date(),
    id: "i2-id",
    name: "ingredient2-id",
    updatedAt: new Date(),
  };
  const mockTeaGuessCreated: TeaGuessWithIngredients = {
    createdAt: new Date(),
    dayId: "day-id",
    guessedIngredients: [mockIngredient1, mockIngredient2],
    guessedPersonName: "user2-id",
    guessedTeaName: "teaname",
    guessedTeaType: TeaType.GREEN,
    id: "guess-id",
    points: 800,
    updatedAt: new Date(),
    userId: "user-id",
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
    vi.mocked(requireSession).mockRejectedValue(new UnauthenticatedError());
    const result = await submitTeaGuess("day-id", null, validFormData);
    expect(result.success).toBe(false);
    expect(result.message).toBe("Debes iniciar sesión");
    expect(createTeaGuess).not.toHaveBeenCalled();
  });

  it("should return validation errors for invalid data", async () => {
    vi.mocked(requireSession).mockResolvedValue(authenticatedSession);
    vi.mocked(validateTeaGuess).mockResolvedValue({
      error: { errors: ["error"], properties: { teaName: { errors: ["value"] } } },
      inputs: { ingredients: [], personName: "", teaName: "", teaType: "" },
      success: false,
    });
    const result = await submitTeaGuess("day-id", null, invalidFormData);
    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(createTeaGuess).not.toHaveBeenCalled();
  });

  it("should return error if user is the owner of the tea or wrong date", async () => {
    vi.mocked(requireSession).mockResolvedValue(authenticatedSession);
    vi.mocked(validateTeaGuess).mockResolvedValue({
      data: {
        ingredients: [mockIngredient1.id, mockIngredient2.id],
        personName: "user2-id",
        teaName: "teaname",
        teaType: TeaType.GREEN,
      },
      success: true,
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
    vi.mocked(requireSession).mockResolvedValue(authenticatedSession);
    vi.mocked(createTeaGuess).mockResolvedValue(mockTeaGuessCreated);
    vi.mocked(validateTeaGuess).mockResolvedValue({
      data: {
        ingredients: [mockIngredient1.id, mockIngredient2.id],
        personName: "user2-id",
        teaName: "teaname",
        teaType: TeaType.GREEN,
      },
      success: true,
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
        ingredients: ["i1-id", "i2-id"],
        personName: "user2-id",
        teaName: "teaname",
        teaType: TeaType.GREEN,
      }),
      expect.anything(),
    );
    expect(revalidatePath).toHaveBeenCalledWith("/teaDay");
  });
});

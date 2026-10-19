import { Prisma } from "@/generated/prisma/client";
import { TeaGuessCreateInput, TeaGuessGetPayload } from "@/generated/prisma/models";
import { prisma } from "@/lib/prisma";

import { TeaGuessFormData } from "../types";

export type TeaGuessWithIngredients = TeaGuessGetPayload<{ include: { guessedIngredients: true } }>;

export async function getLastGuess(userId: string, dayId: string): Promise<null | TeaGuessWithIngredients> {
  const result = await prisma.teaGuess.findFirst({
    include: { guessedIngredients: true },
    orderBy: { createdAt: "desc" },
    where: { dayId, userId },
  });
  return result;
}

export async function getAllGuesses(userId: string, dayId: string): Promise<Array<TeaGuessWithIngredients>> {
  const result = await prisma.teaGuess.findMany({
    include: { guessedIngredients: true },
    orderBy: { createdAt: "desc" },
    where: { dayId, userId },
  });
  return result;
}

export async function createTeaGuess(
  userId: string,
  dayId: string,
  guessData: TeaGuessFormData,
  points: number,
): Promise<null | TeaGuessWithIngredients> {
  const newGuess: TeaGuessCreateInput = {
    day: { connect: { id: dayId } },
    points,
    user: { connect: { id: userId } },
  };

  if (guessData.teaName) {
    newGuess.guessedTeaName = guessData.teaName;
  }

  if (guessData.teaType) {
    newGuess.guessedTeaType = guessData.teaType;
  }

  if (guessData.ingredients && guessData.ingredients.length > 0) {
    newGuess.guessedIngredients = { connect: guessData.ingredients.map((ingredientId) => ({ id: ingredientId })) };
  }

  if (guessData.personName) {
    newGuess.guessedPersonName = guessData.personName;
  }

  try {
    const result = await prisma.teaGuess.create({ data: newGuess, include: { guessedIngredients: true } });
    return result;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return null;
      }
    }
    throw error;
  }
}

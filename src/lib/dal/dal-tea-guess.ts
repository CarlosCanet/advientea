import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

import { TeaGuessFormData } from "../types";

export type TeaGuessWithGuessedIngredients = Prisma.TeaGuessGetPayload<{ include: { guessedIngredients: true } }>;
export type TeaGuessWithGuessedIngredientsAndUser = Prisma.TeaGuessGetPayload<{
  include: { guessedIngredients: true; user: { select: { image: true; username: true } } };
}>;

export async function getLastGuess(userId: string, dayId: string): Promise<null | TeaGuessWithGuessedIngredients> {
  const result = await prisma.teaGuess.findFirst({
    include: { guessedIngredients: true },
    orderBy: { createdAt: "desc" },
    where: { dayId, userId },
  });
  return result;
}

export async function getGuessesByDayId(dayId: string): Promise<Array<TeaGuessWithGuessedIngredientsAndUser>> {
  const result = await prisma.teaGuess.findMany({
    include: { guessedIngredients: true, user: { select: { image: true, username: true } } },
    orderBy: { createdAt: "desc" },
    where: { dayId },
  });
  return result;
}

export async function getGuessesByYear(year: number): Promise<Array<TeaGuessWithGuessedIngredientsAndUser>> {
  const result = await prisma.teaGuess.findMany({
    include: { guessedIngredients: true, user: { select: { image: true, username: true } } },
    orderBy: { createdAt: "desc" },
    where: { day: { year } },
  });
  return result;
}

export async function getAllGuesses(userId: string, dayId: string): Promise<Array<TeaGuessWithGuessedIngredients>> {
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
): Promise<null | TeaGuessWithGuessedIngredients> {
  const newGuess: Prisma.TeaGuessCreateInput = {
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

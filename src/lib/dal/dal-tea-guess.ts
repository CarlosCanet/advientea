import { TeaGuessCreateInput, TeaGuessGetPayload } from "@/generated/prisma/models";
import { prisma } from "@/lib/prisma";
import { TeaGuessFormData } from "../types";
import { Prisma } from "@/generated/prisma/client";

export type TeaGuessWithIngredients = TeaGuessGetPayload<{ include: { guessedIngredients: true } }>;

export async function getLastGuess(userId: string, dayId: string): Promise<TeaGuessWithIngredients | null> {
  const result = await prisma.teaGuess.findFirst({
    where: { dayId, userId },
    include: { guessedIngredients: true },
    orderBy: { createdAt: "desc" },
  });
  return result;
}

export async function getAllGuesses(userId: string, dayId: string): Promise<Array<TeaGuessWithIngredients>> {
  const result = await prisma.teaGuess.findMany({
    where: { dayId, userId },
    include: { guessedIngredients: true },
    orderBy: { createdAt: "desc" },
  })
  return result;
}

export async function createTeaGuess(userId: string, dayId: string, guessData: TeaGuessFormData, points: number): Promise<TeaGuessWithIngredients | null>{
  let newGuess: TeaGuessCreateInput = {
    day: { connect: { id: dayId } },
    user: { connect: { id: userId } },
    guessedIngredients: { connect: guessData.ingredients?.map(ingredientId => ({ id: ingredientId })) || [] },
    guessedTeaName: guessData.teaName,
    guessedTeaType: guessData.teaType,    
    points
  }
  if (guessData.personType === "userId") {
    newGuess = {
      ...newGuess,
      guessedUser: { connect: { id: guessData.personName } },
    }
  } else {
    newGuess = {
      ...newGuess,
      guessedGuestName: guessData.personName,
    }
  }
  try {
    const result = await prisma.teaGuess.create({ data: newGuess, include: { guessedIngredients: true } });
    return result;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        return null;
      }
    }
    throw error;
  }
}
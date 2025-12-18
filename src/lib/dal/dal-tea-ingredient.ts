import { prisma } from "@/lib/prisma";
import {  TeaIngredient } from "@/generated/prisma/client";

export async function getAllIngredients(): Promise<Array<TeaIngredient> | null> {
  const result = await prisma.teaIngredient.findMany({
    orderBy: { name: "asc" },
  });
  return result;
}
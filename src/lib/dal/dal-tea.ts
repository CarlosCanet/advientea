import { Prisma, Tea } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { toParticipantName } from "@/lib/utils";

import { storyTeaWithImagesInclude } from "./includes";

// A tea hangs from its participation, and the day is reached through it. Only these fields are loaded:
// the payloads reach client components and the participation row carries the guest token.
const teaWithIngredientsAndParticipationDayInclude = {
  ingredients: true,
  participation: { select: { day: true, id: true, userId: true, year: true } },
} satisfies Prisma.TeaInclude;
export type TeaWithIngredientsAndParticipationDay = Prisma.TeaGetPayload<{
  include: typeof teaWithIngredientsAndParticipationDayInclude;
}>;
const teaWithIngredientsAndParticipationDayAndStoryImagesInclude = {
  ...teaWithIngredientsAndParticipationDayInclude,
  story: { include: storyTeaWithImagesInclude },
} satisfies Prisma.TeaInclude;
export type TeaWithIngredientsAndParticipationDayAndStoryImages = Prisma.TeaGetPayload<{
  include: typeof teaWithIngredientsAndParticipationDayAndStoryImagesInclude;
}>;

export async function getTeaById(id: string): Promise<null | TeaWithIngredientsAndParticipationDayAndStoryImages> {
  return prisma.tea.findUnique({
    include: teaWithIngredientsAndParticipationDayAndStoryImagesInclude,
    where: { id },
  });
}

export async function getUsernameAssignedToTea(id: string): Promise<null | string> {
  const tea = await prisma.tea.findUnique({
    select: { participation: { select: { guestName: true, user: { select: { username: true } } } } },
    where: { id },
  });
  if (!tea) {
    return null;
  }
  return toParticipantName(tea.participation);
}

export async function addTea(
  data: Prisma.TeaCreateWithoutParticipationInput,
  ingredientIds: Array<string>,
  participationId: string,
): Promise<TeaWithIngredientsAndParticipationDay> {
  const participation = await prisma.participation.findUnique({
    select: { tea: { select: { id: true } } },
    where: { id: participationId },
  });
  if (!participation) {
    throw new Error(`The participation with id ${participationId} does not exist.`);
  }
  if (participation.tea) {
    throw new Error(`The participation with id ${participationId} already has a tea.`);
  }

  return prisma.tea.create({
    data: {
      ...data,
      ingredients: { connect: ingredientIds.map((id) => ({ id })) },
      participation: { connect: { id: participationId } },
    },
    include: teaWithIngredientsAndParticipationDayInclude,
  });
}

export type TeaContentInput = Partial<
  Pick<
    Tea,
    | "addMilk"
    | "canReinfuse"
    | "hasTheine"
    | "infusionTime"
    | "moreIndications"
    | "name"
    | "reinfuseNumber"
    | "storeName"
    | "teaType"
    | "temperature"
    | "url"
  >
> & { ingredientIds?: Array<string> };
export async function updateTeaContent(
  id: string,
  content: TeaContentInput,
): Promise<TeaWithIngredientsAndParticipationDay> {
  const { ingredientIds, ...fields } = content;
  return prisma.tea.update({
    data: {
      ...fields,
      ingredients: ingredientIds ? { set: ingredientIds.map((ingredientId) => ({ id: ingredientId })) } : undefined,
    },
    include: teaWithIngredientsAndParticipationDayInclude,
    where: { id },
  });
}

export async function deleteTea(id: string): Promise<TeaWithIngredientsAndParticipationDay> {
  const teaDeleted = await prisma.tea.delete({
    include: teaWithIngredientsAndParticipationDayInclude,
    where: { id },
  });
  return teaDeleted;
}

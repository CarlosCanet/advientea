import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

import { DayYear, getDayByDayNumber } from "./dal-day";

export type TeaWithDayAndIngredientsAndStoryImages = Prisma.TeaGetPayload<{
  include: { day: true; ingredients: true; story: { include: { images: true } } };
}>;
export type TeaWithDayAndIngredients = Prisma.TeaGetPayload<{ include: { day: true; ingredients: true } }>;

export async function getTeaById(id: string): Promise<null | TeaWithDayAndIngredientsAndStoryImages> {
  const tea = await prisma.tea.findUnique({
    include: { day: true, ingredients: true, story: { include: { images: { orderBy: { order: "asc" } } } } },
    where: { id },
  });
  if (!tea) return null;
  return tea;
}

export async function getTeaByDayNumber(dayYear: DayYear): Promise<null | TeaWithDayAndIngredientsAndStoryImages> {
  const dayResponse = await getDayByDayNumber(dayYear);
  if (!dayResponse || !dayResponse.tea) return null;
  const teaResponse = await prisma.tea.findUnique({
    include: { day: true, ingredients: true, story: { include: { images: { orderBy: { order: "asc" } } } } },
    where: { id: dayResponse.tea.id },
  });
  if (!teaResponse) return null;
  return teaResponse;
}

export async function getAllTeas(year: number): Promise<TeaWithDayAndIngredientsAndStoryImages[]> {
  const teas = await prisma.tea.findMany({
    include: { day: true, ingredients: true, story: { include: { images: { orderBy: { order: "asc" } } } } },
    where: { day: { year } },
  });
  return teas;
}

export async function getUsernameAssignedToTea(id: string): Promise<null | string> {
  const tea = await prisma.tea.findUnique({
    select: { day: { select: { assignment: { select: { guestName: true, user: { select: { username: true } } } } } } },
    where: { id },
  });
  const assignment = tea?.day?.assignment;
  if (!assignment) return null;
  return assignment.guestName ?? assignment.user?.username ?? null;
}

export async function addTea(
  data: Prisma.TeaCreateWithoutDayInput,
  ingredientIds: Array<string> = [],
  dayYear?: DayYear,
): Promise<null | TeaWithDayAndIngredients> {
  let dayConnection: Prisma.DayCreateNestedOneWithoutTeaInput | undefined = undefined;

  if (dayYear !== undefined) {
    const dayRecord = await prisma.day.findUnique({
      include: { tea: true },
      where: { dayNumber_year: { dayNumber: dayYear.dayNumber, year: dayYear.year } },
    });
    if (!dayRecord) throw new Error(`Day ${dayYear.dayNumber}/${dayYear.year} does not exist`);
    if (dayRecord.tea) throw new Error(`Day ${dayYear.dayNumber}/${dayYear.year} already has a tea assigned`);
    dayConnection = { connect: { id: dayRecord.id } };
  }

  const tea = await prisma.tea.create({
    data: {
      ...data,
      day: dayConnection,
      ingredients: { connect: ingredientIds.map((id) => ({ id })) },
    },
    include: { day: true, ingredients: true },
  });
  return tea;
}

export async function addTeaComplete(
  teaData: Prisma.TeaCreateInput,
  ingredientIds: Array<string> = [],
  storyData: Prisma.StoryTeaCreateWithoutTeaInput,
  storyImagesData: Array<Prisma.StoryImageCreateWithoutStoryInput>,
  dayYear: DayYear,
): Promise<null | TeaWithDayAndIngredients> {
  const dayResponse = await getDayByDayNumber(dayYear);
  if (!dayResponse) return null;
  const tea = await prisma.tea.create({
    data: {
      ...teaData,
      day: { connect: { id: dayResponse.id } },
      ingredients: { connect: ingredientIds.map((id) => ({ id })) },
      story: {
        create: {
          ...storyData,
          images: {
            create: storyImagesData,
          },
        },
      },
    },
    include: { day: true, ingredients: true },
  });
  return tea;
}

type EditTeaInput = Prisma.TeaUncheckedUpdateInput & { ingredientIds?: Array<string> };
export async function editTea(
  dataWithIngredients: EditTeaInput,
  id: string,
  newDayYear?: DayYear,
): Promise<null | TeaWithDayAndIngredients> {
  const { ingredientIds, ...data } = dataWithIngredients;
  const currentTea = await prisma.tea.findUnique({ select: { dayId: true }, where: { id } });
  if (!currentTea) throw new Error(`No tea found for id ${id}`);
  const result = await prisma.$transaction(async (tx) => {
    if (newDayYear) {
      const dayRecord = await tx.day.findFirst({
        include: { assignment: true, tea: true },
        where: { dayNumber: newDayYear.dayNumber, year: newDayYear.year },
      });
      if (!dayRecord) throw new Error(`Day ${newDayYear.dayNumber}/${newDayYear.year} not found`);
      if (dayRecord.tea && dayRecord.tea.id !== id)
        throw new Error(`Day ${newDayYear.dayNumber}/${newDayYear.year} already has a tea`);
      if (dayRecord.assignment) throw new Error(`Day ${newDayYear.dayNumber} already has a user assigned`);
      delete data.dayId;
      data.dayId = dayRecord.id;

      if (currentTea.dayId) {
        const oldAssignment = await tx.dayAssignment.findUnique({ where: { dayId: currentTea.dayId } });
        if (oldAssignment) {
          await tx.dayAssignment.update({
            data: { dayId: dayRecord.id },
            where: { id: oldAssignment.id },
          });
        }
      }
    }
    const teaUpdated = await tx.tea.update({
      data: {
        ...data,
        ingredients: ingredientIds ? { set: ingredientIds.map((id) => ({ id })) } : undefined,
      },
      include: { day: true, ingredients: true },
      where: { id },
    });
    return teaUpdated;
  });
  return result;
}

export async function editTeaComplete(
  id: string,
  dataWithIngredients: EditTeaInput,
  storyData: Prisma.StoryTeaCreateWithoutTeaInput,
  storyImagesData: Array<Prisma.StoryImageCreateWithoutStoryInput>,
): Promise<TeaWithDayAndIngredientsAndStoryImages> {
  const { ingredientIds, ...teaData } = dataWithIngredients;
  const tea = await prisma.tea.update({
    data: {
      ...teaData,
      ingredients: ingredientIds ? { set: ingredientIds.map((id) => ({ id })) } : undefined,
      story: {
        upsert: {
          create: {
            ...storyData,
            images: {
              create: storyImagesData,
            },
          },
          update: {
            ...storyData,
            images: {
              create: storyImagesData,
              deleteMany: {},
            },
          },
        },
      },
    },
    include: { day: true, ingredients: true, story: { include: { images: { orderBy: { order: "asc" } } } } },
    where: { id },
  });
  return tea;
}

export async function deleteTea(id: string): Promise<TeaWithDayAndIngredients> {
  const teaDeleted = await prisma.tea.delete({
    include: { day: true, ingredients: true },
    where: { id },
  });
  return teaDeleted;
}

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

import { getDay } from "./dal-day";

export type TeaWithDayAndCompleteStory = Prisma.TeaGetPayload<{
  include: { day: true; ingredients: true; story: { include: { images: true } } };
}>;
export type TeaWithDay = Prisma.TeaGetPayload<{ include: { day: true; ingredients: true } }>;
export type TeaWithIngredients = Prisma.TeaGetPayload<{ include: { ingredients: true } }>;

export async function getTea(id: string): Promise<TeaWithDayAndCompleteStory>;
export async function getTea(day: number, year?: number): Promise<TeaWithDayAndCompleteStory>;

export async function getTea(
  idOrDay: number | string,
  year: number = 2025,
): Promise<null | TeaWithDayAndCompleteStory> {
  if (typeof idOrDay === "string") {
    const tea = await prisma.tea.findUnique({
      include: { day: true, ingredients: true, story: { include: { images: { orderBy: { order: "asc" } } } } },
      where: { id: idOrDay },
    });
    if (!tea) return null;
    return tea;
  }
  const day = idOrDay;
  const dayResponse = await getDay(day, year);
  if (!dayResponse || !dayResponse.tea) return null;
  const teaResponse = await prisma.tea.findUnique({
    include: { day: true, ingredients: true, story: { include: { images: { orderBy: { order: "asc" } } } } },
    where: { id: dayResponse.tea.id },
  });
  if (!teaResponse) return null;
  return teaResponse;
}

export async function getAllTeas(year: number): Promise<TeaWithDayAndCompleteStory[]> {
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
  day?: number,
  year: number = 2025,
): Promise<null | TeaWithDay> {
  let dayConnection: Prisma.DayCreateNestedOneWithoutTeaInput | undefined = undefined;

  if (day !== undefined) {
    const dayRecord = await prisma.day.findUnique({
      include: { tea: true },
      where: { dayNumber_year: { dayNumber: day, year } },
    });
    if (!dayRecord) throw new Error(`Day ${day}/${year} does not exist`);
    if (dayRecord.tea) throw new Error(`Day ${day}/${year} already has a tea assigned`);
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
  day: number,
  year: number = 2025,
): Promise<null | TeaWithDay> {
  const dayResponse = await getDay(day, year);
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
  newDayNumber?: number,
): Promise<null | TeaWithDay> {
  const { ingredientIds, ...data } = dataWithIngredients;
  const currentTea = await prisma.tea.findUnique({ select: { dayId: true }, where: { id } });
  if (!currentTea) throw new Error(`No tea found for id ${id}`);
  const result = await prisma.$transaction(async (tx) => {
    if (newDayNumber) {
      const dayRecord = await tx.day.findFirst({
        include: { assignment: true, tea: true },
        where: { dayNumber: newDayNumber },
      });
      if (!dayRecord) throw new Error(`Day ${newDayNumber}/2025 not found`);
      if (dayRecord.tea && dayRecord.tea.id !== id) throw new Error(`Day ${newDayNumber}/2025 already has a tea`);
      if (dayRecord.assignment) throw new Error(`Day ${newDayNumber} already has a user assigned`);
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
): Promise<TeaWithDayAndCompleteStory> {
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

export async function deleteTea(id: string): Promise<TeaWithDay> {
  const teaDeleted = await prisma.tea.delete({
    include: { day: true, ingredients: true },
    where: { id },
  });
  return teaDeleted;
}

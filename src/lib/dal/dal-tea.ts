import { Prisma, Tea } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

import { DayYear, getDayByDayNumber } from "./dal-day";
import { storyTeaWithImagesInclude } from "./includes";

const teaWithDayAndIngredientsInclude = { day: true, ingredients: true } satisfies Prisma.TeaInclude;
export type TeaWithDayAndIngredients = Prisma.TeaGetPayload<{ include: typeof teaWithDayAndIngredientsInclude }>;
const teaWithDayAndIngredientsAndStoryImagesInclude = {
  ...teaWithDayAndIngredientsInclude,
  story: { include: storyTeaWithImagesInclude },
} satisfies Prisma.TeaInclude;
export type TeaWithDayAndIngredientsAndStoryImages = Prisma.TeaGetPayload<{
  include: typeof teaWithDayAndIngredientsAndStoryImagesInclude;
}>;

export async function getTeaById(id: string): Promise<null | TeaWithDayAndIngredientsAndStoryImages> {
  const tea = await prisma.tea.findUnique({
    include: teaWithDayAndIngredientsAndStoryImagesInclude,
    where: { id },
  });
  if (!tea) return null;
  return tea;
}

export async function getTeaByDayNumber(dayYear: DayYear): Promise<null | TeaWithDayAndIngredientsAndStoryImages> {
  const dayResponse = await getDayByDayNumber(dayYear);
  if (!dayResponse || !dayResponse.tea) return null;
  const teaResponse = await prisma.tea.findUnique({
    include: teaWithDayAndIngredientsAndStoryImagesInclude,
    where: { id: dayResponse.tea.id },
  });
  if (!teaResponse) return null;
  return teaResponse;
}

export async function getAllTeas(year: number): Promise<TeaWithDayAndIngredientsAndStoryImages[]> {
  const teas = await prisma.tea.findMany({
    include: teaWithDayAndIngredientsAndStoryImagesInclude,
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
    include: teaWithDayAndIngredientsInclude,
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
    include: teaWithDayAndIngredientsInclude,
  });
  return tea;
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
export async function updateTeaContent(id: string, content: TeaContentInput): Promise<TeaWithDayAndIngredients> {
  const { ingredientIds, ...fields } = content;
  return prisma.tea.update({
    data: {
      ...fields,
      ingredients: ingredientIds ? { set: ingredientIds.map((ingredientId) => ({ id: ingredientId })) } : undefined,
    },
    include: teaWithDayAndIngredientsInclude,
    where: { id },
  });
}

export async function deleteTea(id: string): Promise<TeaWithDayAndIngredients> {
  const teaDeleted = await prisma.tea.delete({
    include: teaWithDayAndIngredientsInclude,
    where: { id },
  });
  return teaDeleted;
}

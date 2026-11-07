import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

import { DayYear, getDayByDayNumber } from "./dal-day";
import { storyTeaWithImagesInclude } from "./includes";

export type StoryTeaWithImages = Prisma.StoryTeaGetPayload<{ include: typeof storyTeaWithImagesInclude }>;
const storyTeaWithImagesAndTeaInclude = { ...storyTeaWithImagesInclude, tea: true } satisfies Prisma.StoryTeaInclude;
export type StoryTeaWithImagesAndTea = Prisma.StoryTeaGetPayload<{ include: typeof storyTeaWithImagesAndTeaInclude }>;
export type StoryTeaWithTea = Prisma.StoryTeaGetPayload<{ include: { tea: true } }>;

export async function getStoryTeaById(id: string): Promise<null | StoryTeaWithImagesAndTea> {
  const story = await prisma.storyTea.findUnique({
    include: storyTeaWithImagesAndTeaInclude,
    where: { id },
  });
  if (!story) return null;
  return story;
}

export async function getStoryTeaByDayNumber(dayYear: DayYear): Promise<null | StoryTeaWithImagesAndTea> {
  const dayResponse = await getDayByDayNumber(dayYear);
  if (!dayResponse || !dayResponse.tea?.story) return null;
  const result: StoryTeaWithImagesAndTea = { ...dayResponse.tea.story, tea: dayResponse.tea };
  return result;
}

export async function getAllStoriesTea(): Promise<StoryTeaWithImagesAndTea[]> {
  try {
    const stories = await prisma.storyTea.findMany({ include: storyTeaWithImagesAndTeaInclude });
    return stories;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

export async function addStoryTea(
  data: Omit<Prisma.StoryTeaCreateInput, "tea">,
  teaId: string,
): Promise<StoryTeaWithTea> {
  const storyTea = await prisma.storyTea.create({
    data: { ...data, tea: { connect: { id: teaId } } },
    include: { tea: true },
  });
  return storyTea;
}

export async function editStoryTea(data: Prisma.StoryTeaUncheckedUpdateInput, id: string): Promise<StoryTeaWithTea> {
  const storyUpdated = await prisma.storyTea.update({
    data,
    include: { tea: true },
    where: { id },
  });
  return storyUpdated;
}

export async function deleteStoryTea(id: string): Promise<StoryTeaWithTea> {
  const storyDeleted = await prisma.storyTea.delete({
    include: { tea: true },
    where: { id },
  });
  return storyDeleted;
}

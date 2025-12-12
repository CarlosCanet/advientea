import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getDay } from "./dal-day";

export type StoryWithTeaAndImages = Prisma.StoryTeaGetPayload<{ include: { tea: true, images: true } }>;
export type StoryWithTea = Prisma.StoryTeaGetPayload<{ include: { tea: true } }>;

export async function getStoryTea(id: string): Promise<StoryWithTeaAndImages | null>;
export async function getStoryTea(day: number, year: number): Promise<StoryWithTeaAndImages | null>;
export async function getStoryTea(idOrDay: string | number, year: number = 2025): Promise<StoryWithTeaAndImages | null> {
  if (typeof idOrDay === "string") {
    const story = await prisma.storyTea.findUnique({
      where: { id: idOrDay },
      include: { tea: true, images: true }
    });
    if (!story) return null;
    return story;
  }
  const day = idOrDay
  const dayResponse = await getDay(day, year);
  if (!dayResponse || !dayResponse.tea?.story) return null
  const result: StoryWithTeaAndImages = { ... dayResponse.tea.story, tea: dayResponse.tea}  
  return result;
}

export async function getAllStoriesTea(): Promise<StoryWithTeaAndImages[]> {
  try {
    const stories = await prisma.storyTea.findMany({ include: { tea: true, images: { orderBy: { order: "asc" } } } });
    return stories;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

export async function addStoryTea(data: Omit<Prisma.StoryTeaCreateInput, "tea">, teaId: string): Promise<StoryWithTea> {
  const storyTea = await prisma.storyTea.create({ data: { ...data, tea: { connect: { id: teaId } } }, include: { tea: true } });
  return storyTea;
}

export async function editStoryTea(data: Prisma.StoryTeaUncheckedUpdateInput, id: string): Promise<StoryWithTea> {
  const storyUpdated = await prisma.storyTea.update({
    where: { id },
    include: { tea: true },
    data
  });
  return storyUpdated;
}

export async function deleteStoryTea(id: string): Promise<StoryWithTea> {
  const storyDeleted = await prisma.storyTea.delete({
    where: { id },
    include: { tea: true }
  });
  return storyDeleted;
}
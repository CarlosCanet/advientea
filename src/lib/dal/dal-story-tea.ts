import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getDay } from "./dal-day";
import { StoryTeaGetPayload } from "@/generated/prisma/models";
import { getTea } from "./dal-tea";

export async function getStoryTea(id: string): Promise<StoryTeaGetPayload<{ include: { tea: true, images: true } }>>;
export async function getStoryTea(day: number, year?: number): Promise<StoryTeaGetPayload<{ include: { tea: true, images: true } }>>;

export async function getStoryTea(idOrDay: string | number, year: number = 2025): Promise<Prisma.StoryTeaGetPayload<{ include: { tea: true, images: true } }>> {
  try {
    if (typeof idOrDay === "string") {
      const story = await prisma.storyTea.findUnique({
        where: { id: idOrDay },
        include: { tea: true, images: true }
      });
      if (!story) {
        throw new Error(`Story with id ${idOrDay} not found`);
      }
      return story;
    }
    const day = idOrDay
    const dayResponse = await getDay(day, year);
    if (!dayResponse.tea?.story) {
      throw new Error(`There is not story tea for ${day}/${year}`);
    }
    const story = await prisma.storyTea.findUnique({
      where: { id: dayResponse.tea.story.id },
      include: { tea: true, images: true }
    });
    if (!story) {
      throw new Error(`Story with id ${dayResponse.tea.story.id} not found`);
    }
    return story;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

export async function getAllStoriesTea(): Promise<Prisma.StoryTeaGetPayload<{ include: { tea: true, images: true } }>[]> {
  try {
    const stories = await prisma.storyTea.findMany({ include: { tea: true, images: true } });
    return stories;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

export async function addStoryTea(data: Omit<Prisma.StoryTeaCreateInput, "tea">, day: number, year: number = 2025): Promise<StoryTeaGetPayload<{ include: { tea: true } }>> {
  try {
    const teaResponse = await getTea(day, year);
    const storyTea = await prisma.storyTea.create({ data: { ...data, tea: { connect: { id: teaResponse.id } } }, include: { tea: true } });
    return storyTea;
  } catch (error) {
    console.error(error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      console.error("Unique constraint violation creating story tea.");
    }
    throw error;
  }
}

export async function editStoryTea(data: Prisma.StoryTeaUncheckedUpdateInput, id: string): Promise<StoryTeaGetPayload<{ include: { tea: true } }>>;
export async function editStoryTea(data: Prisma.StoryTeaUncheckedUpdateInput, day: number, year?: number): Promise<StoryTeaGetPayload<{ include: { tea: true } }>>;

export async function editStoryTea(data: Prisma.StoryTeaUncheckedUpdateInput, dayOrId: number | string, year: number = 2025): Promise<StoryTeaGetPayload<{ include: { tea: true } }>> {
  try {
    if (typeof dayOrId === "string") {
      const storyUpdated = await prisma.storyTea.update({
        where: { id: dayOrId },
        include: { tea: true },
        data
      });
      return storyUpdated;
    }
    const teaResponse = await getTea(dayOrId, year);
    if (!teaResponse.story) {
      throw new Error(`No tea story found for day ${dayOrId}/${year}`);
    }
    const teaUpdated = await prisma.storyTea.update({
      where: { id: teaResponse.story.id },
      include: { tea: true },
      data
    });
    return teaUpdated;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

export async function deleteStoryTea(id: string): Promise<StoryTeaGetPayload<{ include: { tea: true } }>>;
export async function deleteStoryTea(day: number, year?: number): Promise<StoryTeaGetPayload<{ include: { tea: true } }>>;

export async function deleteStoryTea (dayOrId: number | string, year: number = 2025): Promise<StoryTeaGetPayload<{ include: { tea: true } }>> {
  try {
    if (typeof dayOrId === "string") {
      const storyDeleted = await prisma.storyTea.delete({
        where: { id: dayOrId },
        include: { tea: true }
      });
      return storyDeleted;
    }
    const teaResponse = await getTea(dayOrId, year);
    if (!teaResponse.story) {
      throw new Error(`No tea story found for day ${dayOrId}/${year}`);
    }
    const result = await prisma.storyTea.delete({
      where: { id: teaResponse.story.id },
      include: { tea: true }
    });
    return result;
  } catch (error) {
    console.error(error);
    throw error;
  }
}
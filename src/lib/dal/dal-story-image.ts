import { Prisma, StoryImage } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { StoryImageGetPayload } from "@/generated/prisma/models";
import { getTea } from "./dal-tea";

export async function getStoryImage(id: string): Promise<StoryImage>;
export async function getStoryImage(order: number, day: number, year: number ): Promise<StoryImage>;

export async function getStoryImage(idOrOrder: string | number, day?: number, year: number = 2025): Promise<StoryImage> {
  try {
    if (typeof idOrOrder === "string") {
      const image = await prisma.storyImage.findUnique({ where: { id: idOrOrder } });
      if (!image) {
        throw new Error(`No story image found for id ${idOrOrder}`);
      }
      return image;
    }
    if (!day) {
      throw new Error("Day is mandatory when searching by day");
    }
    const order = idOrOrder;
    const teaResponse = await getTea(day, year);
    if (!teaResponse.story || !teaResponse.story.images) {
      throw new Error(`No story found for day ${day}/${year}`);
    }
    return teaResponse.story.images[order];
  } catch (error) {
    console.error(error);
    throw error;
  }
}

export async function getAllStoryImages(storyTeaId: string): Promise<StoryImage[]> {
  try {
    const images = await prisma.storyImage.findMany({
      where: { storyTeaId },
      orderBy: { order: "asc" },
    });
    return images;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

export async function addStoryImage(publicId: string, order: number, day: number, year: number = 2025): Promise<StoryImageGetPayload<{ include: { story: true } }>> {
  try {
    const teaResponse = await getTea(day, year);
    if (!teaResponse.story) {
      throw new Error(`There is not story tea for ${day}/${year}.`);
    }
    const dayImages = await getAllStoryImages(teaResponse.story.id);
    const maxOrder = dayImages.length === 0 ? -1 : dayImages[dayImages.length - 1].order;
    if (order > maxOrder + 1) {
      order = maxOrder + 1;
    } else {
      await prisma.storyImage.updateMany({
        where: { storyTeaId: teaResponse.story.id, order: { gte: order } },
        data: { order: { increment: 1 } }
      });
    }
    
    const storyImage = await prisma.storyImage.create({
      data: { publicId, order, story: { connect: { id: teaResponse.story.id } } },
      include: { story: true }
    });
    return storyImage;
  } catch (error) {
    console.error(`Error adding the image with publicId: ${publicId}, in the order: ${order}, in day: ${day}/${year}`,error);
    throw error;
  }
}

export async function editStoryImage(data: Prisma.StoryImageUncheckedUpdateInput, id: string): Promise<StoryImage>;
export async function editStoryImage(data: Prisma.StoryImageUncheckedUpdateInput, order: number, day: number, year?: number): Promise<StoryImage>;

export async function editStoryImage(data: Prisma.StoryImageUncheckedUpdateInput, idOrOrder: number | string, day?: number, year: number = 2025): Promise<StoryImage> {
  try {
    if (typeof idOrOrder === "string") {
      const imageUpdated = await prisma.storyImage.update({ where: { id: idOrOrder }, data });
      return imageUpdated;
    }
    if (!day) {
      throw new Error("Day is mandatory if editing by order");
    }
    const order = idOrOrder;
    const teaResponse = await getTea(day, year);
    if (!teaResponse.story) {
      throw new Error(`There is not story tea for ${day}/${year}.`);
    }
    const teaUpdated = await prisma.storyImage.update({ where: { storyTeaId_order: { storyTeaId: teaResponse.story.id, order } }, data });
    return teaUpdated;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

export async function deleteStoryImage(id: string): Promise<StoryImage>;
export async function deleteStoryImage(order: number, day: number, year?: number): Promise<StoryImage>;

export async function deleteStoryImage (orderOrId: number | string, day?: number, year: number = 2025): Promise<StoryImage> {
  try {
    if (typeof orderOrId === "string") {
      const imageDeleted = await prisma.storyImage.delete({ where: { id: orderOrId } });
      return imageDeleted;
    }
    if (!day) {
      throw new Error("Day is mandatory if deleting by order");
    }
    const order = orderOrId;
    const teaResponse = await getTea(day, year);
    if (!teaResponse.story) {
      throw new Error(`No tea story found for day ${day}/${year}`);
    }
    const result = await prisma.storyImage.delete({ where: { storyTeaId_order: { storyTeaId: teaResponse.story.id, order} } });
    return result;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

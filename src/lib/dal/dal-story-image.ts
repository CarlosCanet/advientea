import { Prisma, StoryImage } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getTea } from "./dal-tea";
import { getStoryTea } from "./dal-story-tea";
import { deleteAsset } from "../cloudinary";

export type StoryImageWithStory = Prisma.StoryImageGetPayload<{ include: { story: true } }>;

export async function getStoryImage(id: string): Promise<StoryImage>;
export async function getStoryImage(order: number, day: number, year: number ): Promise<StoryImage>;

export async function getStoryImage(idOrOrder: string | number, day?: number, year: number = 2025): Promise<StoryImage> {
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
}

export async function getAllStoryImages(storyTeaId: string): Promise<StoryImage[]> {
  const images = await prisma.storyImage.findMany({
    where: { storyTeaId },
    orderBy: { order: "asc" },
  });
  return images;
}

export async function addStoryImage(publicId: string, order: number, storyId: string): Promise<StoryImageWithStory> {
  const storyRecord = await getStoryTea(storyId);
  if (!storyRecord) throw new Error(`There is not story tea with id ${storyId}.`);
  const result = await prisma.$transaction(async (tx) => {
    const count = await tx.storyImage.count({ where: { storyTeaId: storyId } });
    let finalOrder = order;
    if (order > count) {
      finalOrder = count;
    } else {
      await tx.storyImage.updateMany({
        where: { storyTeaId: storyId, order: { gte: order } },
        data: { order: { increment: 1 } }
      });
    }
    const imageCreated = await tx.storyImage.create({
      data: {
        publicId,
        order: finalOrder,
        story: { connect: { id: storyId } }
      },
      include: { story: true }
    });
    return imageCreated;
  });
  return result;
}

export async function editStoryImage(data: Prisma.StoryImageUncheckedUpdateInput, id: string): Promise<StoryImage> {
  const imageUpdated = await prisma.storyImage.update({ where: { id }, data });
  return imageUpdated;
}

export async function deleteStoryImage(id: string): Promise<StoryImage> {
  const imageDeleted = await prisma.storyImage.delete({ where: { id } });
  await deleteAsset(imageDeleted.publicId);
  return imageDeleted;
}

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

export type StoryImageSlot = { kind: "existing"; id: string } | { kind: "new"; publicId: string };

/**
 * Makes the story's images match `slots` exactly, in that order, inside one transaction.
 * Existing ids are validated against the story's own rows, so a caller can never touch another story's images.
 * Rows not present in `slots` are deleted. Returns the public ids of the deleted rows so the caller can
 * remove the assets from Cloudinary after the transaction has committed.
 */
export async function replaceStoryImages(storyTeaId: string, slots: StoryImageSlot[]): Promise<string[]> {
  return prisma.$transaction(async (tx) => {
    const current = await tx.storyImage.findMany({ where: { storyTeaId }, select: { id: true, publicId: true } });
    const currentIds = new Set(current.map((img) => img.id));
    const keptSlots = slots.filter(
      (slot): slot is Extract<StoryImageSlot, { kind: "existing" }> => slot.kind === "existing" && currentIds.has(slot.id),
    );
    const keptIds = new Set(keptSlots.map((slot) => slot.id));
    const removed = current.filter((img) => !keptIds.has(img.id));

    if (removed.length > 0) {
      await tx.storyImage.deleteMany({ where: { storyTeaId, id: { in: removed.map((img) => img.id) } } });
    }
    // Park kept rows at negative orders first: final orders are 0..n-1 and would collide with the unique index otherwise.
    for (const [i, slot] of keptSlots.entries()) {
      await tx.storyImage.update({ where: { id: slot.id }, data: { order: -i - 1 } });
    }
    let order = 0;
    for (const slot of slots) {
      if (slot.kind === "existing") {
        if (!currentIds.has(slot.id)) continue;
        await tx.storyImage.update({ where: { id: slot.id }, data: { order } });
      } else {
        await tx.storyImage.create({ data: { publicId: slot.publicId, order, storyTeaId } });
      }
      order++;
    }
    return removed.map((img) => img.publicId);
  });
}

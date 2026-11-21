import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export type StoryImageSlot = { id: string; kind: "existing" } | { kind: "new"; publicId: string };

/**
 * Makes the story's images match `slots` exactly, in that order, inside one transaction.
 * Existing ids are validated against the story's own rows, so a caller can never touch another story's images.
 * Rows not present in `slots` are deleted. Returns the public ids of the deleted rows so the caller can
 * remove the assets from Cloudinary after the transaction has committed.
 */
export async function replaceStoryImages(storyTeaId: string, slots: StoryImageSlot[]): Promise<string[]> {
  return prisma.$transaction((tx) => replaceStoryImagesInTransaction(tx, storyTeaId, slots));
}

/** replaceStoryImages inside a transaction the caller already holds. */
export async function replaceStoryImagesInTransaction(
  tx: Prisma.TransactionClient,
  storyTeaId: string,
  slots: StoryImageSlot[],
): Promise<string[]> {
  const current = await tx.storyImage.findMany({ select: { id: true, publicId: true }, where: { storyTeaId } });
  const currentIds = new Set(current.map((img) => img.id));
  const keptSlots = slots.filter(
    (slot): slot is Extract<StoryImageSlot, { kind: "existing" }> =>
      slot.kind === "existing" && currentIds.has(slot.id),
  );
  const keptIds = new Set(keptSlots.map((slot) => slot.id));
  const removed = current.filter((img) => !keptIds.has(img.id));

  if (removed.length > 0) {
    await tx.storyImage.deleteMany({ where: { id: { in: removed.map((img) => img.id) }, storyTeaId } });
  }
  // Park kept rows at negative orders first: final orders are 0..n-1 and would collide with the unique index otherwise.
  for (const [i, slot] of keptSlots.entries()) {
    await tx.storyImage.update({ data: { order: -i - 1 }, where: { id: slot.id } });
  }
  let order = 0;
  for (const slot of slots) {
    if (slot.kind === "existing") {
      if (!currentIds.has(slot.id)) continue;
      await tx.storyImage.update({ data: { order }, where: { id: slot.id } });
    } else {
      await tx.storyImage.create({ data: { order, publicId: slot.publicId, storyTeaId } });
    }
    order++;
  }
  return removed.map((img) => img.publicId);
}

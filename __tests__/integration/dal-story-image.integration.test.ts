import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { replaceStoryImages } from "@/lib/dal";

// Seed (test-utils): "Ruta del desierto" has a story with 3 images (orders 0,1,2); "Pakistaní" has a story with 1.
async function storyOf(teaName: string) {
  return prisma.storyTea.findFirstOrThrow({
    where: { tea: { name: teaName } },
    include: { images: { orderBy: { order: "asc" } } },
  });
}

describe("dal StoryImage · replaceStoryImages", () => {
  it("keeps, reorders, adds and deletes in one call, and returns the deleted public ids", async () => {
    const story = await storyOf("Ruta del desierto");
    const [first, second, third] = story.images;

    // Final list: third moves to the front, a new one goes in the middle, first stays last, second is dropped.
    const removed = await replaceStoryImages(story.id, [
      { kind: "existing", id: third.id },
      { kind: "new", publicId: "samples/new-image" },
      { kind: "existing", id: first.id },
    ]);

    const after = await storyOf("Ruta del desierto");
    expect(after.images.map((img) => [img.publicId, img.order])).toEqual([
      [third.publicId, 0],
      ["samples/new-image", 1],
      [first.publicId, 2],
    ]);
    expect(removed).toEqual([second.publicId]);
  });

  it("survives a full reversal without violating the unique (storyTeaId, order) index", async () => {
    const story = await storyOf("Ruta del desierto");
    const reversed = [...story.images].reverse().map((img) => ({ kind: "existing" as const, id: img.id }));

    await expect(replaceStoryImages(story.id, reversed)).resolves.toEqual([]);

    const after = await storyOf("Ruta del desierto");
    expect(after.images.map((img) => img.id)).toEqual(reversed.map((slot) => slot.id));
    expect(after.images.map((img) => img.order)).toEqual([0, 1, 2]);
  });

  it("ignores ids that belong to another story and never touches that story", async () => {
    const mine = await storyOf("Ruta del desierto");
    const theirs = await storyOf("Pakistaní");
    const foreignImage = theirs.images[0];

    const removed = await replaceStoryImages(mine.id, [
      { kind: "existing", id: foreignImage.id }, // must be ignored, not adopted nor deleted
      { kind: "existing", id: mine.images[0].id },
    ]);

    const mineAfter = await storyOf("Ruta del desierto");
    const theirsAfter = await storyOf("Pakistaní");
    expect(mineAfter.images.map((img) => img.id)).toEqual([mine.images[0].id]);
    expect(theirsAfter.images.map((img) => img.id)).toEqual([foreignImage.id]);
    expect(theirsAfter.images[0].order).toBe(foreignImage.order);
    expect(removed.sort()).toEqual(
      mine.images
        .slice(1)
        .map((img) => img.publicId)
        .sort(),
    );
  });

  it("deletes every image when the final list is empty", async () => {
    const story = await storyOf("Ruta del desierto");
    const removed = await replaceStoryImages(story.id, []);

    const after = await storyOf("Ruta del desierto");
    expect(after.images).toHaveLength(0);
    expect(removed.sort()).toEqual(story.images.map((img) => img.publicId).sort());
  });
});

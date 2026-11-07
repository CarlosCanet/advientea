import { Prisma } from "@/generated/prisma/client";

// Imports nothing but Prisma: a DAL import here would cycle back through dal-day.

/** The story with its images in display order. */
export const storyTeaWithImagesInclude = { images: { orderBy: { order: "asc" } } } satisfies Prisma.StoryTeaInclude;

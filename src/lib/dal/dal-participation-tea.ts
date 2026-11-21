import { EditionStatus, Prisma } from "@/generated/prisma/client";
import { getNow } from "@/lib/advientea-time";
import { ConflictError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

import { getEditionInfo } from "./dal-edition";
import { PARTICIPATION_GONE } from "./dal-participation";
import { replaceStoryImagesInTransaction, StoryImageSlot } from "./dal-story-image";
import { getDayLock } from "./day-lock";
import { storyTeaWithImagesInclude } from "./includes";

// The participation row carries the guest token, so only these fields are loaded: the payload reaches the tea form.
const participationForTeaEditingSelect = {
  day: true,
  edition: { select: { name: true, status: true, year: true } },
  id: true,
  tea: { include: { story: { include: storyTeaWithImagesInclude } } },
  userId: true,
  year: true,
} satisfies Prisma.ParticipationSelect;
export type ParticipationForTeaEditing = Prisma.ParticipationGetPayload<{
  select: typeof participationForTeaEditingSelect;
}>;

/**
 * The participation whose tea the user is preparing: the one in the active edition, otherwise the one in the
 * latest edition in preparation. An archived edition is over, so it never counts.
 */
export async function getOpenParticipationByUserId(userId: string): Promise<null | ParticipationForTeaEditing> {
  const participations = await prisma.participation.findMany({
    orderBy: { year: "desc" },
    select: participationForTeaEditingSelect,
    where: { edition: { status: { in: [EditionStatus.ACTIVE, EditionStatus.PREPARING] } }, userId },
  });
  return (
    participations.find((participation) => participation.edition.status === EditionStatus.ACTIVE) ??
    participations[0] ??
    null
  );
}

/** Whether the participation's day has opened or has guesses. A participation without a day has played nothing. */
export async function isParticipationDayPlayed(participationId: string, now: Date = getNow()): Promise<boolean> {
  const participation = await prisma.participation.findUnique({
    select: { day: { select: { dayNumber: true } }, year: true },
    where: { id: participationId },
  });
  if (!participation?.day) {
    return false;
  }
  const lock = await getDayLock(prisma, participation.day.dayNumber, await getEditionInfo(participation.year), now);
  return lock !== null;
}

export type ParticipationTeaInput = {
  content: {
    addMilk: boolean;
    canReinfuse: boolean;
    hasTheine: boolean;
    infusionTime: number;
    moreIndications?: string;
    name: string;
    reinfuseNumber?: number;
    storeName?: string;
    temperature: number;
    url?: string;
  };
  images: Array<StoryImageSlot>;
  story: { onlyMusic: boolean; storyPart1?: string; storyPart2?: string; storyPart3?: string; youtubeURL?: string };
};

export type SavedParticipationTea = {
  /** True when this call created the tea. */
  created: boolean;
  /** Cloudinary assets of the image rows this call deleted, for the caller to delete once this has committed. */
  removedPublicIds: Array<string>;
  teaId: string;
};

// A blank field is stored as null, so emptying it in the form clears it.
function toNullableText(value: string | undefined): null | string {
  return value === undefined || value.trim() === "" ? null : value;
}

function toTeaContentData(content: ParticipationTeaInput["content"]) {
  return {
    addMilk: content.addMilk,
    canReinfuse: content.canReinfuse,
    hasTheine: content.hasTheine,
    infusionTime: content.infusionTime,
    moreIndications: toNullableText(content.moreIndications),
    name: content.name,
    reinfuseNumber: content.reinfuseNumber ?? null,
    storeName: toNullableText(content.storeName),
    temperature: content.temperature,
    url: toNullableText(content.url),
  };
}

function toStoryData(story: ParticipationTeaInput["story"]) {
  return {
    onlyMusic: story.onlyMusic,
    storyPart1: toNullableText(story.storyPart1),
    storyPart2: toNullableText(story.storyPart2),
    storyPart3: toNullableText(story.storyPart3),
    youtubeURL: toNullableText(story.youtubeURL),
  };
}

/**
 * Creates or updates the tea of a participation, with its story and images, in one transaction. Ingredients
 * and the tea type are never touched, and neither is the participation's day. With `refuseArchivedEdition`, an
 * archived edition refuses the save. With `refusePlayedDay`, a tea whose day has opened or has guesses cannot
 * be changed: those guesses were scored against it. A missing tea can always be created, since without a tea
 * nobody could guess, so nothing has been scored.
 */
export async function saveParticipationTea(
  participationId: string,
  input: ParticipationTeaInput,
  options: { refuseArchivedEdition: boolean; refusePlayedDay: boolean },
  now: Date = getNow(),
): Promise<SavedParticipationTea> {
  try {
    return await prisma.$transaction(async (tx) => {
      // Locked before it is read: two saves of one participation run one after the other, so the second finds
      // the tea the first created instead of creating another, and unenrolParticipant waits for this one.
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "DayAssignment" WHERE "id" = ${participationId} FOR UPDATE
      `;
      if (locked.length === 0) {
        throw new ConflictError(PARTICIPATION_GONE);
      }
      // Each relation is read with its own query: several in one include run at once on the transaction's
      // single connection, which pg deprecates.
      const participation = await tx.participation.findUniqueOrThrow({
        select: { dayId: true, year: true },
        where: { id: participationId },
      });
      const { year } = participation;
      const edition = await tx.edition.findUniqueOrThrow({
        select: { _count: { select: { participations: true } }, status: true, year: true },
        where: { year },
      });
      if (options.refuseArchivedEdition && edition.status === EditionStatus.ARCHIVED) {
        throw new ConflictError(`La edición ${year} está archivada y sus tés ya no se pueden cambiar.`);
      }
      const existingTea = await tx.tea.findUnique({ select: { id: true }, where: { participationId } });
      if (options.refusePlayedDay && existingTea && participation.dayId) {
        const day = await tx.day.findUniqueOrThrow({ select: { dayNumber: true }, where: { id: participation.dayId } });
        const editionInfo = { lastDayNumber: edition._count.participations, status: edition.status, year };
        if ((await getDayLock(tx, day.dayNumber, editionInfo, now)) !== null) {
          throw new ConflictError(
            "Tu día ya ha abierto y tu té ya no se puede cambiar. Si hay un error, avisa al GerenTé.",
          );
        }
      }

      const content = toTeaContentData(input.content);
      const tea = existingTea
        ? await tx.tea.update({ data: content, select: { id: true }, where: { id: existingTea.id } })
        : await tx.tea.create({ data: { ...content, participationId }, select: { id: true } });

      const storyData = toStoryData(input.story);
      let story = existingTea ? await tx.storyTea.findUnique({ select: { id: true }, where: { teaId: tea.id } }) : null;
      if (story) {
        await tx.storyTea.update({ data: storyData, where: { id: story.id } });
      } else {
        const hasStory =
          storyData.onlyMusic ||
          storyData.storyPart1 !== null ||
          storyData.storyPart2 !== null ||
          storyData.storyPart3 !== null ||
          storyData.youtubeURL !== null ||
          // An existing slot cannot belong to a story that does not exist yet, so only a new one counts.
          input.images.some((slot) => slot.kind === "new");
        if (hasStory) {
          story = await tx.storyTea.create({ data: { ...storyData, teaId: tea.id }, select: { id: true } });
        }
      }

      // A story created just now has no rows yet, so existing slots find nothing to keep and are ignored.
      const removedPublicIds = story ? await replaceStoryImagesInTransaction(tx, story.id, input.images) : [];
      return { created: existingTea === null, removedPublicIds, teaId: tea.id };
    });
  } catch (error) {
    // The lock should leave no room for this; the foreign keys answer for a participation deleted mid-flight anyway.
    if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2003" || error.code === "P2025")) {
      throw new ConflictError(PARTICIPATION_GONE);
    }
    throw error;
  }
}

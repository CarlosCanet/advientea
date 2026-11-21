import { EditionStatus, Role } from "@/generated/prisma/enums";
import { canEditTea } from "@/lib/advientea-rules";
import { deleteAsset, uploadImage } from "@/lib/cloudinary";
import {
  getEdition,
  getParticipationById,
  isParticipationDayPlayed,
  ParticipationTeaInput,
  saveParticipationTea,
  StoryImageSlot,
} from "@/lib/dal";
import { ConflictError, ForbiddenError } from "@/lib/errors";

/** Who saves: a signed-in account, or a guest through their secret link, who can only reach their own participation. */
export type TeaActor = { id: string; kind: "user"; role: Role } | { kind: "guest"; participationId: string };

const DAY_PLAYED = "Tu día ya ha abierto y tu té ya no se puede cambiar. Si hay un error, avisa al GerenTé.";

export type TeaSubmission = {
  content: ParticipationTeaInput["content"];
  /** Existing images the form keeps, with their final position. */
  keptImages: Array<{ id: string; order: number }>;
  /** New files, with their final position. */
  newImages: Array<{ file: File; order: number }>;
  story: ParticipationTeaInput["story"];
};

/** Uploads every file, or none: when one fails, the ones already up are deleted and the save stops here. */
async function uploadStoryImages(files: Array<File>, year: number): Promise<Array<string>> {
  const results = await Promise.allSettled(files.map((file) => uploadImage(file, { kind: "teaDay", year })));
  const publicIds = results.flatMap((result) =>
    result.status === "fulfilled" && result.value !== undefined ? [result.value] : [],
  );
  if (publicIds.length < files.length) {
    await Promise.allSettled(publicIds.map((publicId) => deleteAsset(publicId)));
    throw new Error(`Only ${publicIds.length} of ${files.length} story images could be uploaded.`);
  }
  return publicIds;
}

/** The final image list, by position; on a tie a kept image goes before a new one. */
function toImageSlots(
  keptImages: TeaSubmission["keptImages"],
  newImages: TeaSubmission["newImages"],
  newPublicIds: Array<string>,
): Array<StoryImageSlot> {
  const placed: Array<{ order: number; slot: StoryImageSlot }> = [
    ...keptImages.map((image) => ({ order: image.order, slot: { id: image.id, kind: "existing" as const } })),
    ...newImages.map((image, i) => ({ order: image.order, slot: { kind: "new" as const, publicId: newPublicIds[i] } })),
  ];
  // toSorted is stable, so equal orders keep kept-before-new.
  return placed.toSorted((first, second) => first.order - second.order).map((entry) => entry.slot);
}

/**
 * The only way the app creates or edits a tea: on behalf of `actor`, for the tea of a participation.
 * A user or a guest whose day has been played is refused before anything is uploaded, and again by the DAL,
 * atomically with the write.
 */
export async function saveTeaForParticipation(
  actor: TeaActor,
  participationId: string,
  submission: TeaSubmission,
): Promise<{ created: boolean }> {
  const participation = await getParticipationById(participationId);
  if (!participation) {
    throw new ConflictError("Esa inscripción ya no existe.");
  }
  const edition = await getEdition(participation.year);
  if (!edition) {
    throw new ConflictError("Esa inscripción ya no existe.");
  }
  const mayEdit =
    actor.kind === "guest"
      ? actor.participationId === participationId && edition.status !== EditionStatus.ARCHIVED
      : canEditTea(actor.role, {
          editionStatus: edition.status,
          isDayPlayed: false,
          isOwn: participation.userId === actor.id,
        });
  if (!mayEdit) {
    throw new ForbiddenError("No puedes editar este té.");
  }
  // A guest is held to the same rules as a USER.
  const isRestricted = actor.kind === "guest" || actor.role === Role.USER;
  const options = {
    refuseArchivedEdition: actor.kind === "guest" || actor.role !== Role.ADMIN,
    refusePlayedDay: isRestricted,
  };
  // Checked here as well as in the DAL so that a refused save uploads nothing.
  if (isRestricted && participation.tea && (await isParticipationDayPlayed(participationId))) {
    throw new ConflictError(DAY_PLAYED);
  }

  const uploadedPublicIds = await uploadStoryImages(
    submission.newImages.map((image) => image.file),
    participation.year,
  );
  const images = toImageSlots(submission.keptImages, submission.newImages, uploadedPublicIds);

  let saved;
  try {
    saved = await saveParticipationTea(
      participationId,
      { content: submission.content, images, story: submission.story },
      options,
    );
  } catch (error) {
    await Promise.allSettled(uploadedPublicIds.map((publicId) => deleteAsset(publicId)));
    throw error;
  }

  // Best effort, after the commit: a failed asset deletion must not undo the save.
  await Promise.allSettled(saved.removedPublicIds.map((publicId) => deleteAsset(publicId)));
  return { created: saved.created };
}

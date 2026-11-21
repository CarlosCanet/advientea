import { Role } from "@/generated/prisma/enums";
import { canEditTea } from "@/lib/advientea-rules";
import { deleteAsset, uploadImage } from "@/lib/cloudinary";
import {
  getEdition,
  getParticipationById,
  ParticipationTeaInput,
  saveParticipationTea,
  StoryImageSlot,
} from "@/lib/dal";
import { ConflictError, ForbiddenError } from "@/lib/errors";

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
 * A user whose day has been played is refused by the DAL, atomically with the write.
 */
export async function saveTeaForParticipation(
  actor: { id: string; role: Role },
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
  const mayEdit = canEditTea(actor.role, {
    editionStatus: edition.status,
    isDayPlayed: false,
    isOwn: participation.userId === actor.id,
  });
  if (!mayEdit) {
    throw new ForbiddenError("No puedes editar este té.");
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
      { refuseArchivedEdition: actor.role !== Role.ADMIN, refusePlayedDay: actor.role === Role.USER },
    );
  } catch (error) {
    await Promise.allSettled(uploadedPublicIds.map((publicId) => deleteAsset(publicId)));
    throw error;
  }

  // Best effort, after the commit: a failed asset deletion must not undo the save.
  await Promise.allSettled(saved.removedPublicIds.map((publicId) => deleteAsset(publicId)));
  return { created: saved.created };
}

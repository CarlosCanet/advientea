"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { EditionStatus, Role } from "@/generated/prisma/enums";
import { deleteAsset } from "@/lib/cloudinary";
import {
  changeEditionStatus,
  createEdition,
  deleteDay,
  deleteEdition,
  enrolGuest,
  enrolUser,
  placeParticipant,
  requireRole,
  swapParticipants,
  unenrolParticipant,
  unplaceParticipant,
} from "@/lib/dal";
import { ConflictError, ForbiddenError, UnauthenticatedError } from "@/lib/errors";
import {
  deleteDaySchema,
  editionFormSchema,
  editionStatusChangeSchema,
  enrolGuestSchema,
  enrolUserSchema,
  placeParticipantSchema,
  swapParticipantsSchema,
  unenrolParticipantSchema,
} from "@/lib/schemas/edition";
import { ActionResponse, EditionActionResponse, EditionFormData } from "@/lib/types";
import { EDITION_STATUS_LABELS, toParticipantName } from "@/lib/utils";

import { getFormNumber, getFormString } from "./commonActions";

// Guard and conflict errors carry a message meant for the user; anything else gets the fallback.
function failure(action: string, error: unknown, fallback: string): ActionResponse {
  const isExpected =
    error instanceof UnauthenticatedError || error instanceof ForbiddenError || error instanceof ConflictError;
  if (isExpected) {
    console.warn(`[${action}] rejected: ${error.name} — ${error.message}`);
    return { message: error.message, success: false };
  }
  console.error(`[${action}] unexpected error`, error);
  return { message: fallback, success: false };
}

export async function createEditionAction(
  prevState: EditionActionResponse,
  formData: FormData,
): Promise<EditionActionResponse> {
  const rawData: EditionFormData = {
    name: getFormString(formData, "name"),
    year: getFormNumber(formData, "year"),
  };
  try {
    await requireRole(Role.ADMIN);
    const validatedFields = editionFormSchema.safeParse(rawData);
    if (!validatedFields.success) {
      return {
        errors: z.treeifyError(validatedFields.error),
        inputs: rawData,
        message: "Hay errores en el formulario",
        success: false,
      };
    }
    const { name, year } = validatedFields.data;
    await createEdition(name, year);
    revalidatePath("/editions");
    return { message: `Edición ${year} creada. Está en preparación.`, success: true };
  } catch (error: unknown) {
    return {
      ...failure("createEditionAction", error, "No se pudo crear la edición. Inténtalo de nuevo."),
      inputs: rawData,
    };
  }
}

export async function changeEditionStatusAction(year: number, status: EditionStatus): Promise<ActionResponse> {
  try {
    await requireRole(Role.ADMIN);
    const validatedFields = editionStatusChangeSchema.safeParse({ status, year });
    if (!validatedFields.success) {
      return { message: "El estado o el año no son válidos.", success: false };
    }
    const { status: newStatus, year: editionYear } = validatedFields.data;
    await changeEditionStatus(editionYear, newStatus);
    revalidatePath("/editions");
    return {
      message: `La edición ${editionYear} ahora está ${EDITION_STATUS_LABELS[newStatus].toLowerCase()}.`,
      success: true,
    };
  } catch (error: unknown) {
    return failure("changeEditionStatusAction", error, "No se pudo cambiar el estado. Inténtalo de nuevo.");
  }
}

export async function deleteEditionAction(year: number): Promise<ActionResponse> {
  try {
    await requireRole(Role.ADMIN);
    await deleteEdition(year);
    revalidatePath("/editions");
    return { message: `Edición ${year} borrada.`, success: true };
  } catch (error: unknown) {
    return failure("deleteEditionAction", error, "No se pudo borrar la edición. Inténtalo de nuevo.");
  }
}

export async function enrolUserAction(year: number, userId: string): Promise<ActionResponse> {
  try {
    await requireRole(Role.ADMIN, Role.EXECUTEAVE);
    const validatedFields = enrolUserSchema.safeParse({ userId, year });
    if (!validatedFields.success) {
      return { message: "La persona o el año no son válidos.", success: false };
    }
    const { userId: enrolledUserId, year: editionYear } = validatedFields.data;
    await enrolUser(editionYear, enrolledUserId);
    revalidatePath(`/editions/${editionYear}`);
    return { message: `Persona inscrita en la edición ${editionYear}.`, success: true };
  } catch (error: unknown) {
    return failure("enrolUserAction", error, "No se pudo inscribir a esa persona. Inténtalo de nuevo.");
  }
}

export async function enrolGuestAction(year: number, name: string): Promise<ActionResponse> {
  try {
    await requireRole(Role.ADMIN, Role.EXECUTEAVE);
    const validatedFields = enrolGuestSchema.safeParse({ name, year });
    if (!validatedFields.success) {
      // The name is what the manager typed, so its message goes back; the year comes from the page.
      const nameIssue = validatedFields.error.issues.find((issue) => issue.path[0] === "name");
      return { message: nameIssue?.message ?? "El año no es válido.", success: false };
    }
    const { name: guestName, year: editionYear } = validatedFields.data;
    // Only the name goes back: the guest token never leaves the server through this action.
    const participation = await enrolGuest(editionYear, guestName);
    revalidatePath(`/editions/${editionYear}`);
    return {
      message: `${participation.guestName} está en la edición ${editionYear} como invitado.`,
      success: true,
    };
  } catch (error: unknown) {
    return failure("enrolGuestAction", error, "No se pudo inscribir al invitado. Inténtalo de nuevo.");
  }
}

const UNNAMED_PARTICIPANT = "Esa persona";
const DELETED_ACCOUNT_HOLDER = "una cuenta borrada";

/** "A", "A y B", "A, B y C". */
function toSpanishList(items: Array<string>): string {
  if (items.length <= 1) {
    return items.join("");
  }
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}

export async function placeParticipantAction(
  participationId: string,
  dayNumber: null | number,
): Promise<ActionResponse> {
  try {
    await requireRole(Role.ADMIN, Role.EXECUTEAVE);
    const validatedFields = placeParticipantSchema.safeParse({ dayNumber, participationId });
    if (!validatedFields.success) {
      return { message: "La inscripción o el día no son válidos.", success: false };
    }
    const { dayNumber: targetDayNumber, participationId: placedParticipationId } = validatedFields.data;
    if (targetDayNumber === null) {
      const participation = await unplaceParticipant(placedParticipationId);
      revalidatePath(`/editions/${participation.year}`);
      return { message: `${toParticipantName(participation) ?? UNNAMED_PARTICIPANT} se queda sin día.`, success: true };
    }
    const participation = await placeParticipant(placedParticipationId, targetDayNumber);
    revalidatePath(`/editions/${participation.year}`);
    return {
      message: `${toParticipantName(participation) ?? UNNAMED_PARTICIPANT} tiene ahora el día ${targetDayNumber}.`,
      success: true,
    };
  } catch (error: unknown) {
    return failure("placeParticipantAction", error, "No se pudo cambiar el día. Inténtalo de nuevo.");
  }
}

export async function swapParticipantsAction(
  firstParticipationId: string,
  secondParticipationId: string,
): Promise<ActionResponse> {
  try {
    await requireRole(Role.ADMIN, Role.EXECUTEAVE);
    const validatedFields = swapParticipantsSchema.safeParse({ firstParticipationId, secondParticipationId });
    if (!validatedFields.success) {
      return { message: "Las inscripciones no son válidas.", success: false };
    }
    const swapped = await swapParticipants(
      validatedFields.data.firstParticipationId,
      validatedFields.data.secondParticipationId,
    );
    const clauses = swapped.map((participation) => {
      const name = toParticipantName(participation) ?? UNNAMED_PARTICIPANT;
      return participation.day ? `${name} pasa al día ${participation.day.dayNumber}` : `${name} se queda sin día`;
    });
    revalidatePath(`/editions/${swapped[0].year}`);
    return { message: `${clauses.join(" y ")}.`, success: true };
  } catch (error: unknown) {
    return failure("swapParticipantsAction", error, "No se pudo intercambiar. Inténtalo de nuevo.");
  }
}

export async function deleteDayAction(dayId: string): Promise<ActionResponse> {
  try {
    await requireRole(Role.ADMIN);
    const validatedFields = deleteDaySchema.safeParse({ dayId });
    if (!validatedFields.success) {
      return { message: "El día no es válido.", success: false };
    }
    const day = await deleteDay(validatedFields.data.dayId);
    revalidatePath(`/editions/${day.year}`);
    return { message: `Día ${day.dayNumber} borrado.`, success: true };
  } catch (error: unknown) {
    return failure("deleteDayAction", error, "No se pudo borrar el día. Inténtalo de nuevo.");
  }
}

export async function unenrolParticipantAction(participationId: string, deleteTea: boolean): Promise<ActionResponse> {
  try {
    await requireRole(Role.ADMIN, Role.EXECUTEAVE);
    const validatedFields = unenrolParticipantSchema.safeParse({ deleteTea, participationId });
    if (!validatedFields.success) {
      return { message: "La inscripción no es válida.", success: false };
    }
    const { holdersOutsideCalendar, lastDayNumber, participation, storyImagePublicIds } = await unenrolParticipant(
      validatedFields.data.participationId,
      { deleteTea: validatedFields.data.deleteTea },
    );
    revalidatePath(`/editions/${participation.year}`);

    // Best effort, after the transaction has committed: the participation is gone whatever happens to its assets.
    const deletions = await Promise.allSettled(storyImagePublicIds.map(async (publicId) => deleteAsset(publicId)));
    deletions.forEach((deletion, index) => {
      if (deletion.status === "rejected") {
        console.error(`[unenrolParticipantAction] asset ${storyImagePublicIds[index]} not deleted`, deletion.reason);
      } else if (deletion.value === undefined) {
        console.error(`[unenrolParticipantAction] asset ${storyImagePublicIds[index]} not deleted`);
      }
    });

    const name = toParticipantName(participation) ?? UNNAMED_PARTICIPANT;
    const gone = `${name} ya no está en la edición ${participation.year}`;
    const sentences = [participation.tea ? `${gone} y su té «${participation.tea.name}» se ha borrado.` : `${gone}.`];
    if (holdersOutsideCalendar.length > 0) {
      const holders = toSpanishList(
        holdersOutsideCalendar.map((holder) => `${holder.name ?? DELETED_ACCOUNT_HOLDER} (día ${holder.dayNumber})`),
      );
      const stay = holdersOutsideCalendar.length === 1 ? "se queda fuera" : "se quedan fuera";
      sentences.push(`El calendario acaba ahora en el día ${lastDayNumber}: ${holders} ${stay}.`);
    }
    return { message: sentences.join(" "), success: true };
  } catch (error: unknown) {
    return failure("unenrolParticipantAction", error, "No se pudo quitar la inscripción. Inténtalo de nuevo.");
  }
}

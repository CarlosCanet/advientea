"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { EditionStatus, Role } from "@/generated/prisma/enums";
import { changeEditionStatus, createEdition, deleteEdition, requireRole } from "@/lib/dal";
import { ConflictError, ForbiddenError, UnauthenticatedError } from "@/lib/errors";
import { editionFormSchema, editionStatusChangeSchema } from "@/lib/schemas/edition";
import { ActionResponse, EditionActionResponse, EditionFormData } from "@/lib/types";
import { EDITION_STATUS_LABELS } from "@/lib/utils";

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

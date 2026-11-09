"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { Role } from "@/generated/prisma/enums";
import { activateEdition, archiveEdition, createEdition, requireRole } from "@/lib/dal";
import { ConflictError, ForbiddenError, UnauthenticatedError } from "@/lib/errors";
import { editionFormSchema } from "@/lib/schemas/edition";
import { ActionResponse, EditionActionResponse, EditionFormData } from "@/lib/types";

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

export async function activateEditionAction(year: number): Promise<ActionResponse> {
  try {
    await requireRole(Role.ADMIN);
    await activateEdition(year);
    revalidatePath("/editions");
    return { message: `Edición ${year} activada.`, success: true };
  } catch (error: unknown) {
    return failure("activateEditionAction", error, "No se pudo activar la edición. Inténtalo de nuevo.");
  }
}

export async function archiveEditionAction(year: number): Promise<ActionResponse> {
  try {
    await requireRole(Role.ADMIN);
    await archiveEdition(year);
    revalidatePath("/editions");
    return { message: `Edición ${year} archivada.`, success: true };
  } catch (error: unknown) {
    return failure("archiveEditionAction", error, "No se pudo archivar la edición. Inténtalo de nuevo.");
  }
}

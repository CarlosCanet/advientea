"use server";
import { revalidatePath } from "next/cache";

import { createTeaGuess, requireSession } from "@/lib/dal";
import { ForbiddenError, UnauthenticatedError } from "@/lib/errors";
import {
  calculatePointsFromGuess,
  canUserGuessPerson,
  canUserGuessTea,
  validateTeaGuess,
} from "@/lib/services/tea-guess-service";
import { TeaGuessActionResponse } from "@/lib/types";

export async function submitTeaGuess(
  dayId: string,
  prevState: null | TeaGuessActionResponse,
  formData: FormData,
): Promise<TeaGuessActionResponse> {
  try {
    const { userId } = await requireSession();
    const validatedFields = await validateTeaGuess(formData);
    if (!validatedFields.success) {
      return {
        errors: validatedFields.error,
        inputs: validatedFields.inputs,
        message: "Hay errores en el formulario",
        success: false,
      };
    }
    const userGuessTea =
      validatedFields.data.ingredients || validatedFields.data.teaName || validatedFields.data.teaType;
    const userGuessPerson = validatedFields.data.personName;
    const canGuessPerson = await canUserGuessPerson(dayId, userId);
    const canGuessTea = await canUserGuessTea(dayId, userId);

    if (userGuessPerson && !canGuessPerson) {
      return { message: "No puedes adivinar la persona de este día", success: false };
    }
    if (userGuessTea && !canGuessTea) {
      return { message: "No puedes adivinar el té de este día", success: false };
    }

    const points = await calculatePointsFromGuess(dayId, validatedFields.data);
    if (points === null) {
      return { message: "Ese día no existe", success: false };
    }
    await createTeaGuess(userId, dayId, validatedFields.data, points);
    revalidatePath("/teaDay");

    return { message: "Respuesta guardada", success: true };
  } catch (error: unknown) {
    const isGuardError = error instanceof UnauthenticatedError || error instanceof ForbiddenError;
    if (isGuardError) {
      console.warn(`[submitTeaGuess] rejected: ${error.name} — dayId=${dayId} — ${error.message}`);
    } else {
      console.error("[submitTeaGuess] unexpected error", error);
    }
    return {
      message: isGuardError ? error.message : "No se pudo guardar tu respuesta. Inténtalo de nuevo.",
      success: false,
    };
  }
}

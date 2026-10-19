"use server";
import { createTeaGuess, requireSession } from "@/lib/dal";
import { ForbiddenError, UnauthenticatedError } from "@/lib/errors";
import {
  calculatePointsFromGuess,
  canUserGuessPerson,
  canUserGuessTea,
  validateTeaGuess,
} from "@/lib/services/tea-guess-service";
import { TeaGuessActionResponse } from "@/lib/types";
import { revalidatePath } from "next/cache";

export async function submitTeaGuess(
  dayId: string,
  prevState: TeaGuessActionResponse | null,
  formData: FormData,
): Promise<TeaGuessActionResponse> {
  try {
    const { userId } = await requireSession();
    const validatedFields = await validateTeaGuess(formData);
    if (!validatedFields.success) {
      return {
        success: false,
        message: "Hay errores en el formulario",
        errors: validatedFields.error,
        inputs: validatedFields.inputs,
      };
    }
    const userGuessTea =
      validatedFields.data.ingredients || validatedFields.data.teaName || validatedFields.data.teaType;
    const userGuessPerson = validatedFields.data.personName;
    const canGuessPerson = await canUserGuessPerson(dayId, userId);
    const canGuessTea = await canUserGuessTea(dayId, userId);

    if (userGuessPerson && !canGuessPerson) {
      return { success: false, message: "No puedes adivinar la persona de este día" };
    }
    if (userGuessTea && !canGuessTea) {
      return { success: false, message: "No puedes adivinar el té de este día" };
    }

    const points = await calculatePointsFromGuess(dayId, validatedFields.data);
    if (points === null) {
      return { success: false, message: "Ese día no existe" };
    }
    await createTeaGuess(userId, dayId, validatedFields.data, points);
    revalidatePath("/teaDay");

    return { success: true, message: "Respuesta guardada" };
  } catch (error: unknown) {
    const isGuardError = error instanceof UnauthenticatedError || error instanceof ForbiddenError;
    if (isGuardError) {
      console.warn(`[submitTeaGuess] rejected: ${error.name} — dayId=${dayId} — ${error.message}`);
    } else {
      console.error("[submitTeaGuess] unexpected error", error);
    }
    return {
      success: false,
      message: isGuardError ? error.message : "No se pudo guardar tu respuesta. Inténtalo de nuevo.",
    };
  }
}

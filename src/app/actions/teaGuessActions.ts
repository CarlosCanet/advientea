"use server";
import { auth } from "@/lib/auth";
import { createTeaGuess } from "@/lib/dal";
import { calculatePointsFromGuess, canUserGuessPerson, canUserGuessTea, validateTeaGuess } from "@/lib/services/tea-guess-service";
import { TeaGuessActionResponse } from "@/lib/types";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

export async function submitTeaGuess(dayId: string, prevState: TeaGuessActionResponse | null, formData: FormData): Promise<TeaGuessActionResponse> {
  const session = await auth.api.getSession({ headers: await headers() });
  
  if (!session) {
    return {
      success: false,
      message: "Unauthorized"
    };
  }
  const validatedFields = await validateTeaGuess(formData);
  if (!validatedFields.success) {
    return {
      success: false,
      message: "Validation errors",
      errors: validatedFields.error,
      inputs: validatedFields.inputs,
    }
  }
  const userGuessTea = validatedFields.data.ingredients || validatedFields.data.teaName || validatedFields.data.teaType;
  const userGuessPerson = validatedFields.data.personName;
  const canGuessPerson = await canUserGuessPerson(dayId, session.user.id);
  const canGuessTea = await canUserGuessTea(dayId, session.user.id);
  
  if (userGuessPerson && !canGuessPerson) {
    return {
      success: false,
      message: "You cannot guess the name of the person"
    }
  }

  if (userGuessTea && !canGuessTea) {
    return {
      success: false,
      message: "You cannot guess the tea info"
    }
  }
  
  const points = await calculatePointsFromGuess(dayId, validatedFields.data)
  if (points === null) {
    return {
      success: false,
      message: "The day of the tea you are guessing doesn't exist"
    }
  }
  await createTeaGuess(session.user.id, dayId, validatedFields.data, points);
  revalidatePath("/teaDay");
  
  return ({
    success: true,
    message: "Tea Guess created"
  });
}
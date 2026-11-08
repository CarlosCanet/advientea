import z from "zod";

import { getFormString, getFormStringsByPrefix } from "@/app/actions/commonActions";
import { Role, TeaType } from "@/generated/prisma/enums";

import { getAdvienteaDayState } from "../advientea-rules";
import { getNow } from "../advientea-time";
import { getDayForGuessing, getEditionInfo } from "../dal";
import { calculateDailyScore } from "../tea-guess-scoring";
import { TeaGuessFormData } from "../types";

const TeaGuessFormSchema = z
  .object({
    ingredients: z.array(z.string()).optional(),
    personName: z
      .string()
      .trim()
      .transform((val) => (val === "" ? undefined : val))
      .optional(),
    teaName: z
      .string()
      .trim()
      .transform((val) => (val === "" ? undefined : val))
      .optional(),
    teaType: z.preprocess((val) => (val === "" ? undefined : val), z.enum(TeaType).optional()),
  })
  .refine(
    (data) => {
      const hasTeaName = !!data.teaName;
      const hasPerson = !!data.personName;
      const hasTeaType = !!data.teaType;
      const hasIngredients = data.ingredients && data.ingredients.length > 0;
      return hasTeaName || hasPerson || hasTeaType || hasIngredients;
    },
    {
      error: "Debes intentar adivinar al menos una opción",
      path: ["root"],
    },
  );

export function validateTeaGuess(formData: FormData) {
  const ingredients = getFormStringsByPrefix(formData, "ingredient");
  const rawData = {
    ingredients: ingredients.length > 0 ? ingredients : undefined,
    personName: getFormString(formData, "personName"),
    teaName: getFormString(formData, "teaName"),
    teaType: getFormString(formData, "teaType"),
  };
  const result = TeaGuessFormSchema.safeParse(rawData);
  return result.success ? result : { ...result, error: z.treeifyError(result.error), inputs: rawData };
}

export async function canUserGuessTea(dayId: string, currentUserId: string): Promise<boolean> {
  const dayRecord = await getDayForGuessing(dayId);
  if (!dayRecord || !dayRecord.tea) return false;
  if (dayRecord.assignment?.user?.id === currentUserId) return false;
  const dayState = getAdvienteaDayState(dayRecord.dayNumber, await getEditionInfo(dayRecord.year), Role.USER);
  if (!dayState.isReleased) return false;
  return !dayState.isTeaReleased;
}

export async function canUserGuessPerson(dayId: string, currentUserId: string): Promise<boolean> {
  const dayRecord = await getDayForGuessing(dayId);
  if (!dayRecord || !dayRecord.tea) return false;
  if (dayRecord.assignment?.user?.id === currentUserId) return false;
  const dayState = getAdvienteaDayState(dayRecord.dayNumber, await getEditionInfo(dayRecord.year), Role.USER);
  if (!dayState.isReleased) return false;
  return !dayState.isPersonNameReleased;
}

export async function calculatePointsFromGuess(dayId: string, guessData: TeaGuessFormData): Promise<null | number> {
  const dayGuessedRecord = await getDayForGuessing(dayId);
  if (!dayGuessedRecord || !dayGuessedRecord.tea) return null;

  const teaData: TeaGuessFormData = {
    ingredients: dayGuessedRecord?.tea?.ingredients.map((ing) => ing.name),
    personName: dayGuessedRecord?.assignment?.user?.username ?? dayGuessedRecord?.assignment?.guestName ?? "",
    teaName: dayGuessedRecord?.tea?.name,
    teaType: dayGuessedRecord?.tea?.teaType,
  };
  const timestamp = getNow();

  return calculateDailyScore(teaData, guessData, timestamp);
}

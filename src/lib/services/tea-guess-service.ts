import z from "zod";
import { TeaGuessFormData } from "../types";
import { getFormString, getFormStringsByPrefix } from "@/app/actions/commonActions";
import { Role, TeaType } from "@/generated/prisma/enums";
import { getDayForGuessing } from "../dal";
import { getAdvienteaDayState, isDateTodayOrPast } from "../advientea-rules";

const TeaGuessFormSchema = z.object({
  teaName: z.string().trim().transform(val => val === "" ? undefined : val).optional(),
  teaType: z.preprocess(val => val === "" ? undefined : val, z.enum(TeaType).optional()),
  ingredients: z.array(z.string()).optional(),
  personName: z.string().transform(val => val === "" ? undefined : val).optional(),
}).refine((data) => {
  const hasTeaName = !!data.teaName;
  const hasPerson = !!data.personName;
  const hasTeaType = !!data.teaType;
  const hasIngredients = data.ingredients && data.ingredients.length > 0;
  return hasTeaName || hasPerson || hasTeaType || hasIngredients;
}, {
  error: "Debes intentar adivinar al menos una opción",
  path: ["root"],
});

export function validateTeaGuess(formData: FormData) {
  const rawData = {
    ingredients: getFormStringsByPrefix(formData, "ingredient"),
    personName: getFormString(formData, "personName"),
    teaName: getFormString(formData, "teaName"),
    teaType: getFormString(formData, "teaType"),
  }
  const result = TeaGuessFormSchema.safeParse((rawData));
  return result;
}

export async function canUserGuessTea(dayId: string, currentUserId: string): Promise<boolean> {
  const dayRecord = await getDayForGuessing(dayId);
  if (!dayRecord || !dayRecord.tea) return false;
  if (dayRecord.assignment?.user?.id === currentUserId) return false;
  if (!isDateTodayOrPast(new Date(dayRecord.year, 11, dayRecord.dayNumber))) return false;
  const dayState = getAdvienteaDayState(dayRecord.dayNumber, dayRecord.year, Role.USER);
  return !dayState.isTeaReleased;
}

export async function canUserGuessPerson(dayId: string, currentUserId: string): Promise<boolean>{
  const dayRecord = await getDayForGuessing(dayId);
  if (!dayRecord || !dayRecord.tea) return false;
  if (dayRecord.assignment?.user?.id === currentUserId) return false;
  if (!isDateTodayOrPast(new Date(dayRecord.year, 11, dayRecord.dayNumber))) return false;
  const dayState = getAdvienteaDayState(dayRecord.dayNumber, dayRecord.year, Role.USER);
  return !dayState.isPersonNameReleased;
}
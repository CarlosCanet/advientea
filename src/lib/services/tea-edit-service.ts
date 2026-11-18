import { Role } from "@/generated/prisma/enums";
import { canEditTea } from "@/lib/advientea-rules";
import { getEdition, getParticipationByUserId, TeaWithDayAndIngredients } from "@/lib/dal";

/** Whether this user may change this tea, under canEditTea. */
export async function userCanEditTea(
  user: { id: string; role: Role },
  tea: Pick<TeaWithDayAndIngredients, "day">,
): Promise<boolean> {
  if (!tea.day) {
    return false;
  }
  const [participation, edition] = await Promise.all([
    getParticipationByUserId(user.id, tea.day.year),
    getEdition(tea.day.year),
  ]);
  if (!edition) {
    return false;
  }
  return canEditTea(user.role, { editionStatus: edition.status, isOwn: participation?.dayId === tea.day.id });
}

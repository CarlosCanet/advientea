import { Role } from "@/generated/prisma/enums";
import { canEditTea } from "@/lib/advientea-rules";
import { getDayAssignmentByUserId, getEdition, TeaWithDayAndIngredients } from "@/lib/dal";

/** Whether this user may change this tea, under canEditTea. */
export async function userCanEditTea(
  user: { id: string; role: Role },
  tea: Pick<TeaWithDayAndIngredients, "day">,
): Promise<boolean> {
  if (!tea.day) {
    return false;
  }
  const [assignment, edition] = await Promise.all([
    getDayAssignmentByUserId(user.id, tea.day.year),
    getEdition(tea.day.year),
  ]);
  if (!edition) {
    return false;
  }
  return canEditTea(user.role, { editionStatus: edition.status, isOwn: assignment?.dayId === tea.day.id });
}

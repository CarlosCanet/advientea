import { Role } from "@/generated/prisma/enums";
import { canEditTea } from "@/lib/advientea-rules";
import { getCurrentEdition, getDayAssignmentByUserId, TeaWithDayAndIngredients } from "@/lib/dal";

/** Whether this user may change this tea, under canEditTea. */
export async function userCanEditTea(
  user: { id: string; role: Role },
  tea: Pick<TeaWithDayAndIngredients, "day">,
): Promise<boolean> {
  if (!tea.day) {
    return false;
  }
  const assignment = await getDayAssignmentByUserId(user.id, tea.day.year);
  const currentEdition = await getCurrentEdition();
  return canEditTea(
    user.role,
    { editionYear: tea.day.year, isOwn: assignment?.dayId === tea.day.id },
    currentEdition?.year,
  );
}

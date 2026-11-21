import { Role } from "@/generated/prisma/enums";
import { canEditTea } from "@/lib/advientea-rules";
import { getEdition, TeaWithIngredientsAndParticipationDay } from "@/lib/dal";

/** Whether this user may change this tea, under canEditTea. */
export async function userCanEditTea(
  user: { id: string; role: Role },
  tea: Pick<TeaWithIngredientsAndParticipationDay, "participation">,
): Promise<boolean> {
  const edition = await getEdition(tea.participation.year);
  if (!edition) {
    return false;
  }
  return canEditTea(user.role, { editionStatus: edition.status, isOwn: tea.participation.userId === user.id });
}

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import NoActiveEdition from "@/components/ui/NoActiveEdition";
import WaitForDayAssignment from "@/components/ui/WaitForDayAssignment";
import { Role } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import { getActiveEdition, getParticipationByUserId } from "@/lib/dal";

async function EditTeaInfo() {
  const session = await auth.api.getSession({ headers: await headers() });
  const edition = await getActiveEdition();
  const isUserPrivileged = session?.user.role === Role.ADMIN || session?.user.role === Role.EXECUTEAVE;
  if (!session) {
    redirect("/");
  }
  if (!edition) {
    return <NoActiveEdition />;
  }
  const assignment = await getParticipationByUserId(session.user.id, edition.year);
  if (assignment?.tea) {
    redirect(`/edit-tea-info/${assignment.tea.id}`);
  }
  if (isUserPrivileged) {
    redirect(`/editions/${edition.year}`);
  }
  return <WaitForDayAssignment />;
}
export default EditTeaInfo;

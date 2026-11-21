import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import EditTeaInfoForm from "@/components/EditTeaInfoForm";
import WaitForDayAssignment from "@/components/ui/WaitForDayAssignment";
import { Role } from "@/generated/prisma/enums";
import { auth } from "@/lib/auth";
import { getParticipationByUserId, getTeaById, getUsernameAssignedToTea } from "@/lib/dal";
import { userCanEditTea } from "@/lib/services/tea-edit-service";

async function EditTeaInfoDayPage({ params }: { params: Promise<{ teaId: string }> }) {
  const { teaId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/");
  }
  const teaCompleteInfo = await getTeaById(teaId);
  if (!teaCompleteInfo) {
    notFound();
  }
  if (session.user.role === Role.USER) {
    const assignment = await getParticipationByUserId(session.user.id, teaCompleteInfo.participation.year);
    if (!assignment) {
      return <WaitForDayAssignment />;
    } else if (!assignment.tea) {
      redirect("/add-tea-info");
    } else if (assignment.tea.id !== teaId) {
      redirect(`/edit-tea-info/${assignment.tea.id}`);
    }
  }
  if (!(await userCanEditTea(session.user, teaCompleteInfo))) {
    notFound();
  }
  const username = await getUsernameAssignedToTea(teaId);

  return (
    <div className="flex justify-center">
      <EditTeaInfoForm
        dayNumber={teaCompleteInfo.participation.day?.dayNumber}
        teaCompleteInfo={teaCompleteInfo}
        teaId={teaId}
        username={username || ""}
      />
    </div>
  );
}
export default EditTeaInfoDayPage;

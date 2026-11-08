import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import EditTeaInfoForm from "@/components/EditTeaInfoForm";
import WaitForDayAssignment from "@/components/ui/WaitForDayAssignment";
import { Role } from "@/generated/prisma/enums";
import { auth } from "@/lib/auth";
import { getCurrentEdition, getDayAssignmentByUserId, getTeaById, getUsernameAssignedToTea } from "@/lib/dal";
import { userCanEditTea } from "@/lib/services/tea-edit-service";

async function EditTeaInfoDayPage({ params }: { params: Promise<{ teaId: string }> }) {
  const { teaId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/");
  }
  const edition = await getCurrentEdition();

  if (session.user.role === Role.USER && edition) {
    const assignment = await getDayAssignmentByUserId(session.user.id, edition.year);
    if (!assignment) {
      return <WaitForDayAssignment />;
    } else if (!assignment.day?.tea) {
      redirect("/add-tea-info");
    } else if (session.user.role === Role.USER && assignment.day.tea.id !== teaId) {
      redirect(`/edit-tea-info/${assignment.day?.tea.id}`);
    }
  }
  const teaCompleteInfo = await getTeaById(teaId);
  if (!teaCompleteInfo || !(await userCanEditTea(session.user, teaCompleteInfo))) {
    notFound();
  }
  const username = await getUsernameAssignedToTea(teaId);

  return (
    <div className="flex justify-center">
      <EditTeaInfoForm
        dayNumber={teaCompleteInfo.day?.dayNumber}
        teaCompleteInfo={teaCompleteInfo}
        teaId={teaId}
        username={username || ""}
      />
    </div>
  );
}
export default EditTeaInfoDayPage;

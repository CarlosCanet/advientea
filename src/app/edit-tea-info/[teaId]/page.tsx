import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import EditTeaInfoForm from "@/components/EditTeaInfoForm";
import WaitForDayAssignment from "@/components/ui/WaitForDayAssignment";
import { Role } from "@/generated/prisma/enums";
import { auth } from "@/lib/auth";
import { getDayAssignment, getTea, getUsernameAssignedToTea } from "@/lib/dal";

async function EditTeaInfoDayPage({ params }: { params: Promise<{ teaId: string }> }) {
  const { teaId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/");
  }

  if (session.user.role === Role.USER) {
    const assignment = await getDayAssignment(2025, session.user.email);
    if (!assignment) {
      return <WaitForDayAssignment />;
    } else if (!assignment.day.tea) {
      redirect("/add-tea-info");
    } else if (session.user.role === Role.USER && assignment.day.tea.id !== teaId) {
      redirect(`/edit-tea-info/${assignment.day.tea.id}`);
    }
  }
  const teaCompleteInfo = await getTea(teaId);
  if (!teaCompleteInfo) {
    notFound();
  }
  const username = await getUsernameAssignedToTea(teaId);

  return (
    <div className="flex justify-center">
      <EditTeaInfoForm
        dayNumber={teaCompleteInfo.day?.dayNumber}
        isExecuTEAve={session.user.role !== Role.USER}
        teaCompleteInfo={teaCompleteInfo}
        teaId={teaId}
        username={username || ""}
      />
    </div>
  );
}
export default EditTeaInfoDayPage;

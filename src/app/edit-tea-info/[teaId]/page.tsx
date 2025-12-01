import EditTeaInfoForm from "@/components/EditTeaInfoForm"
import WaitForDayAssignment from "@/components/ui/WaitForDayAssignment";
import { Role } from "@/generated/prisma/enums";
import { auth } from "@/lib/auth";
import { getDayAssignment, getTea, getUsernameAssignedToTea } from "@/lib/dal";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

async function EditTeaInfoDayPage({ params }: { params: Promise<{ teaId: string }> }) {
  const { teaId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/");
  }

  if (session.user.role === Role.USER) {
    const assignment = await getDayAssignment(2025, session.user.email);
    if (!assignment) {
      return <WaitForDayAssignment />
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
      <EditTeaInfoForm username={username || ""} dayNumber={teaCompleteInfo.day.dayNumber} teaCompleteInfo={teaCompleteInfo} isExecuTEAve={session.user.role !== Role.USER} teaId={teaId} />
    </div>
  )
}
export default EditTeaInfoDayPage
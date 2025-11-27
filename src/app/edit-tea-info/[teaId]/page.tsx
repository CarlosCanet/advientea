import EditTeaInfoForm from "@/components/EditTeaInfoForm"
import WaitForDayAssignment from "@/components/ui/WaitForDayAssignment";
import { Role } from "@/generated/prisma/enums";
import { auth } from "@/lib/auth";
import { getDayAssignment, getTea } from "@/lib/dal";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

async function EditTeaInfoDayPage({ params }: { params: Promise<{ teaId: string }> }) {
  const { teaId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return;
  }
  const assignment = await getDayAssignment(2025, session.user.email);
  if (!assignment) {
    return <WaitForDayAssignment />
  } else if (!assignment.day.tea) {
    redirect("/add-tea-info");
  } else if (session.user.role === Role.USER && assignment.day.tea.id !== teaId) {
    redirect(`/edit-tea-info/${assignment.day.tea.id}`);
  }
  const teaCompleteInfo = await getTea(assignment.day.tea.id);
  
  return (
    <div className="flex justify-center">
      <EditTeaInfoForm username={session.user.name} dayNumber={assignment.day.dayNumber} teaCompleteInfo={teaCompleteInfo}  />
    </div>
  )
}
export default EditTeaInfoDayPage
import WaitForDayAssignment from "@/components/ui/WaitForDayAssignment";
import { Role } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import { getDayAssignment } from "@/lib/dal";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

async function EditTeaInfo() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session && session.user.role === Role.USER) {
    const assignment = await getDayAssignment(2025, session.user.email);
    if (assignment && assignment.day.tea) {
      redirect(`/edit-tea-info/${assignment.day.tea.id}`);
    } else {
      return <WaitForDayAssignment />;
    }
  }

  return (
    <div className="flex justify-center">
      Lista para GerenTés
    </div>
  );
}
export default EditTeaInfo;

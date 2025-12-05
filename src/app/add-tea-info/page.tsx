import AddTeaInfoForm from "@/components/AddTeaInfoForm";
import { Role } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import { getAllDayAssignment, getDayAssignment } from "@/lib/dal";
import { getAllUsers } from "@/lib/dal/dal-user";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

async function AddTeaInfo() {
  const session = await auth.api.getSession({ headers: await headers() });
  let assignment;
  const isUserPrivileged = session?.user.role === Role.ADMIN || session?.user.role === Role.EXECUTEAVE;
  let users: Array<string> = [];
  if (session && session.user) {
    assignment = await getDayAssignment(2025, session.user.email);
    if (isUserPrivileged) {
      const allAssignments = await getAllDayAssignment();
      const allUsers = await getAllUsers(isUserPrivileged);
      const usersWithAssignments = allAssignments.map(assignment => assignment.user?.username);
      users = allUsers.map(user => user.username).filter(user => !usersWithAssignments.includes(user));
    }
    if (assignment &&  assignment.day.tea) {
      redirect("/edit-tea-info")
    }
  }

  return (
    <>
      <div className="flex justify-center">
        <AddTeaInfoForm username={session?.user.name ?? ""} dayNumber={assignment?.day.dayNumber ?? 0} isLoggedIn={!!session?.user} canAssign={isUserPrivileged} users={users} />
      </div>
    </>
  );
}
export default AddTeaInfo;

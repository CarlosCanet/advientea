import AddTeaInfoForm from "@/components/AddTeaInfoForm";
import { Role } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import { getAllDayAssignment, getAllUser, getDayAssignment } from "@/lib/dal";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

async function AddTeaInfo() {
  const session = await auth.api.getSession({ headers: await headers() });
  let assignment;
  let canAssign = false;
  let users: Array<string> = [];
  if (session && session.user) {
    assignment = await getDayAssignment(2025, session.user.email);
    canAssign = session.user.role !== Role.USER;
    if (canAssign) {
      const allAssignments = await getAllDayAssignment();
      const allUsers = await getAllUser();
      const usersWithAssignments = allAssignments.map(assignment => assignment.user.username);
      users = allUsers.map(user => user.username).filter(user => !usersWithAssignments.includes(user));
    }
    if (assignment &&  assignment.day.tea) {
      redirect("/edit-tea-info")
    }
  }

  return (
    <>
      <div className="flex justify-center">
        <AddTeaInfoForm username={session?.user.name ?? ""} dayNumber={assignment?.day.dayNumber ?? 0} isLoggedIn={!!session?.user} canAssign={canAssign} users={users} />
      </div>
    </>
  );
}
export default AddTeaInfo;

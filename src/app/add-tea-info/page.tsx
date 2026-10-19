import { headers } from "next/headers";
import { redirect } from "next/navigation";

import AddTeaInfoForm from "@/components/AddTeaInfoForm";
import { Role } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import { getAllDayAssignment, getAllUsers, getDayAssignment } from "@/lib/dal";

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
      const usersWithAssignments = allAssignments.map((assignment) => assignment.user?.username);
      users = allUsers.map((user) => user.username).filter((user) => !usersWithAssignments.includes(user));
    }
    if (assignment && assignment.day.tea) {
      redirect("/edit-tea-info");
    }
  }

  return (
    <>
      <div className="flex justify-center">
        <AddTeaInfoForm
          canAssign={isUserPrivileged}
          dayNumber={assignment?.day.dayNumber ?? 0}
          isLoggedIn={!!session?.user}
          username={session?.user.name ?? ""}
          users={users}
        />
      </div>
    </>
  );
}
export default AddTeaInfo;

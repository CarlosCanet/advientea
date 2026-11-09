import { headers } from "next/headers";
import { redirect } from "next/navigation";

import AddTeaInfoForm from "@/components/AddTeaInfoForm";
import NoActiveEdition from "@/components/ui/NoActiveEdition";
import { Role } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import { getActiveEdition, getAllDayAssignment, getDayAssignmentByUserId, getUsersBasic } from "@/lib/dal";

async function AddTeaInfo() {
  const session = await auth.api.getSession({ headers: await headers() });
  const edition = await getActiveEdition();
  if (!edition) {
    return <NoActiveEdition />;
  }
  let assignment;
  const isUserPrivileged = session?.user.role === Role.ADMIN || session?.user.role === Role.EXECUTEAVE;
  let users: Array<string> = [];
  if (session && session.user) {
    assignment = await getDayAssignmentByUserId(session.user.id, edition.year);
    if (isUserPrivileged) {
      const allAssignments = await getAllDayAssignment(edition.year);
      const allUsers = await getUsersBasic();
      const usersWithAssignments = allAssignments.map((assignment) => assignment.user?.username);
      users = allUsers.map((user) => user.username).filter((user) => !usersWithAssignments.includes(user));
    }
    if (assignment && assignment.day?.tea) {
      redirect("/edit-tea-info");
    }
  }

  return (
    <>
      <div className="flex justify-center">
        <AddTeaInfoForm
          canAssign={isUserPrivileged}
          dayNumber={assignment?.day?.dayNumber ?? 0}
          isLoggedIn={!!session?.user}
          username={session?.user.name ?? ""}
          users={users}
        />
      </div>
    </>
  );
}
export default AddTeaInfo;

import AssignmentSelect from "@/components/ui/AssignmentSelect";
import WaitForDayAssignment from "@/components/ui/WaitForDayAssignment";
import { Role } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import { getAllDays, getAllUser, getDayAssignment } from "@/lib/dal";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

async function EditTeaInfo() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect("/");
  } else if (session.user.role === Role.USER) {
    const assignment = await getDayAssignment(2025, session.user.email);
    if (assignment && assignment.day.tea) {
      redirect(`/edit-tea-info/${assignment.day.tea.id}`);
    } else {
      return <WaitForDayAssignment />;
    }
  }
  const users = await getAllUser();
  const days = await getAllDays(2025);

  return (
    <div className="flex justify-center">
      <div className="card w-100 lg:w-180 m-10 bg-base-100 shadow-xl p-10 before:content-[''] before:absolute before:inset-0 before:bg-[url('/BackgroundSemiCircleLeaves.svg')] before:bg-no-repeat before:opacity-25">
        Lista para GerenTés
        <div className="overflow-x-auto">
          <table className="table table-zebra">
            {/* head */}
            <thead>
              <tr>
                <th>Día</th>
                <th>Persona</th>
              </tr>
            </thead>
            <tbody>
              {days.map((day) => {
                return (
                  <tr key={day.id}>
                    <th>{day.dayNumber}</th>
                    {/* <td>{day.assignment?.user.username}</td> */}
                    <td>
                      {<AssignmentSelect key={`${day.id}-${day.assignment?.user.id}`} dayId={day.id} userId={day.assignment?.user.id ?? ""} users={users} />}
                    </td>
                    <td><Link href={`/edit-tea-info/${day.tea?.id}`}>{day.tea?.name}</Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
export default EditTeaInfo;

import AssignmentSelect from "@/components/ui/AssignmentSelect";
import ButtonAddDays from "@/components/ui/ButtonAddDays";
import ButtonDeleteDay from "@/components/ui/ButtonDeleteDay";
import WaitForDayAssignment from "@/components/ui/WaitForDayAssignment";
import { Role } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import { getAllDays, getDayAssignment } from "@/lib/dal";
import { getAllUsers } from "@/lib/dal/dal-user";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FaEye } from "react-icons/fa";
import { FaPencil } from "react-icons/fa6";

async function EditTeaInfo() {
  const session = await auth.api.getSession({ headers: await headers() });
  const isUserPrivileged = session?.user.role === Role.ADMIN || session?.user.role === Role.EXECUTEAVE;
  if (!session) {
    redirect("/");
  } else if (!isUserPrivileged) {
    const assignment = await getDayAssignment(2025, session.user.email);
    if (assignment && assignment.day.tea) {
      redirect(`/edit-tea-info/${assignment.day.tea.id}`);
    } else {
      return <WaitForDayAssignment />;
    }
  }
  
  const users = await getAllUsers(isUserPrivileged);
  const days = await getAllDays(2025);

  return (
    <div className="flex justify-center">
      <div className="card w-100 lg:w-180 m-5 bg-base-100 shadow-xl p-5 before:content-[''] before:absolute before:inset-0 before:bg-[url('/BackgroundSemiCircleLeaves.svg')] before:bg-no-repeat before:opacity-15 before:pointer-events-none">
        <div className="flex gap-5 w-full justify-center items-center">
          <div className="text-center text-xl font-bold tracking-tight text-heading md:text-3xl lg:text-4xl">Lista para GerenTés</div>
          <ButtonAddDays daysNumber={days.length} />
        </div>
        <div className="overflow-x-auto">
          <table className="table-xs lg:table table-zebra text-center">
            <thead>
              <tr>
                <th>Día</th>
                <th>Persona</th>
                <th>Té</th>
                <th>A</th>
              </tr>
            </thead>
            <tbody>
              {days.map((day) => {
                return (
                  <tr key={day.id}>
                    <th>{day.dayNumber}</th>
                    <td>
                      {<AssignmentSelect key={`${day.id}-${day.assignment?.user?.id ?? day.assignment?.guestName}`} dayId={day.id} userId={day.assignment?.user?.id ?? ""} users={users} guestName={day.assignment?.guestName ?? undefined} />}
                    </td>
                    <td><Link href={`/edit-tea-info/${day.tea?.id}`}>{day.tea?.name}</Link></td>
                    <td className="flex gap-3 items-center justify-center flex-nowrap">
                      <Link href={`/teaDay/${day.id}?simulated=true`}><FaEye /></Link>
                      <Link href={`/edit-tea-info/${day.tea?.id}`}><FaPencil /></Link>
                      <ButtonDeleteDay dayId={day.id} />
                    </td>
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

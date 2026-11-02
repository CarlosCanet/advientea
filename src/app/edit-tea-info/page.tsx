import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FaEye } from "react-icons/fa";
import { FaPencil } from "react-icons/fa6";

import AssignmentSelect from "@/components/ui/AssignmentSelect";
import ButtonAddDays from "@/components/ui/ButtonAddDays";
import ButtonDeleteDay from "@/components/ui/ButtonDeleteDay";
import NoActiveEdition from "@/components/ui/NoActiveEdition";
import WaitForDayAssignment from "@/components/ui/WaitForDayAssignment";
import { Role } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import { getActiveEdition, getAllDays, getAllUsers, getDayAssignmentByUserId, getUpcomingEdition } from "@/lib/dal";

async function EditTeaInfo() {
  const session = await auth.api.getSession({ headers: await headers() });
  const edition = await getActiveEdition();
  const isUserPrivileged = session?.user.role === Role.ADMIN || session?.user.role === Role.EXECUTEAVE;
  if (!session) {
    redirect("/");
  }
  if (!edition) {
    return <NoActiveEdition nextYear={(await getUpcomingEdition())?.year} />;
  }
  if (!isUserPrivileged) {
    const assignment = await getDayAssignmentByUserId(session.user.id, edition.year);
    if (assignment && assignment.day?.tea) {
      redirect(`/edit-tea-info/${assignment.day?.tea.id}`);
    } else {
      return <WaitForDayAssignment />;
    }
  }

  const users = await getAllUsers(isUserPrivileged);
  const days = await getAllDays(edition.year);

  return (
    <div className="flex justify-center">
      <div className="card w-100 lg:w-180 m-5 bg-base-100 shadow-xl p-5 before:content-[''] before:absolute before:inset-0 before:bg-[url('/BackgroundSemiCircleLeaves.svg')] before:bg-no-repeat before:opacity-15 before:pointer-events-none">
        <div className="flex gap-5 w-full justify-center items-center">
          <div className="text-center text-xl font-bold tracking-tight text-heading md:text-3xl lg:text-4xl">
            Lista para GerenTés
          </div>
          <ButtonAddDays daysNumber={days.length} year={edition.year} />
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
                      {
                        <AssignmentSelect
                          dayId={day.id}
                          guestName={day.assignment?.guestName ?? undefined}
                          key={`${day.id}-${day.assignment?.user?.id ?? day.assignment?.guestName}`}
                          userId={day.assignment?.user?.id ?? ""}
                          users={users}
                        />
                      }
                    </td>
                    <td>
                      <Link href={`/edit-tea-info/${day.tea?.id}`}>{day.tea?.name}</Link>
                    </td>
                    <td className="flex gap-3 items-center justify-center flex-nowrap">
                      <Link href={`/teaDay/${day.id}?simulated=true`}>
                        <FaEye />
                      </Link>
                      <Link href={`/edit-tea-info/${day.tea?.id}`}>
                        <FaPencil />
                      </Link>
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

import { redirect } from "next/navigation";

import CheckboxUsersExecuteave from "@/components/ui/CheckboxUsersExecuteave";
import { Role } from "@/generated/prisma/enums";
import { getAllUsers, getSession } from "@/lib/dal";

export default async function Users() {
  const session = await getSession();
  const isUserPrivileged = session?.user.role === Role.ADMIN || session?.user.role === Role.EXECUTEAVE;
  if (!session || !isUserPrivileged) {
    redirect("/");
  }
  const users = await getAllUsers();

  return (
    <div className="flex justify-center">
      <div className="card w-100 lg:w-180 m-5 bg-base-100 shadow-xl p-5 before:content-[''] before:absolute before:inset-0 before:bg-[url('/BackgroundSemiCircleLeaves.svg')] before:bg-no-repeat before:opacity-15 before:pointer-events-none">
        <div className="flex gap-5 w-full justify-center items-center">
          <div className="text-center text-xl font-bold tracking-tight text-heading md:text-3xl lg:text-4xl">
            Usuarios
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="table-xs lg:table table-zebra">
            <thead>
              <tr>
                <th>Nº</th>
                <th>Usuario</th>
                <th>email</th>
                <th className="w-1">Gerente</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user, i) => {
                return (
                  <tr key={user.id}>
                    <th>{i + 1}</th>
                    <td>{user.username}</td>
                    <td>{user.email}</td>
                    <td className="text-center">
                      {session.user.role === Role.ADMIN && (
                        <CheckboxUsersExecuteave role={user.role} userId={user.id} />
                      )}
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

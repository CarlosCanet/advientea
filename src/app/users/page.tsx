import { redirect } from "next/navigation";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import UsersDirectory from "@/components/users/UsersDirectory";
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
    <div className="px-4 py-5">
      <Card className="mx-auto w-full max-w-3xl max-sm:[--card-spacing:--spacing(4)]">
        <CardHeader>
          <h1 className="text-center font-display text-2xl sm:text-3xl">Usuarios</h1>
        </CardHeader>
        <CardContent>
          <UsersDirectory
            canChangeRoles={session.user.role === Role.ADMIN}
            users={users.map((user) => ({ email: user.email, id: user.id, role: user.role, username: user.username }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}

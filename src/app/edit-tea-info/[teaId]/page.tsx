import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { editTeaInfoAction } from "@/app/actions/teaInfoActions";
import TeaInfoForm from "@/components/TeaInfoForm";
import { Role } from "@/generated/prisma/enums";
import { auth } from "@/lib/auth";
import { getTeaById, getUsernameAssignedToTea } from "@/lib/dal";
import { userCanEditTea } from "@/lib/services/tea-edit-service";

/** The managers' editor for any tea. A participant edits their own on /my-tea. */
async function EditTeaInfoDayPage({ params }: { params: Promise<{ teaId: string }> }) {
  const { teaId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/");
  }
  if (session.user.role === Role.USER) {
    redirect("/my-tea");
  }
  const tea = await getTeaById(teaId);
  if (!tea || !(await userCanEditTea(session.user, tea))) {
    notFound();
  }
  const name = (await getUsernameAssignedToTea(teaId)) ?? "Cuenta borrada";
  const dayNumber = tea.participation.day?.dayNumber;

  return (
    <div className="flex justify-center">
      <TeaInfoForm
        action={editTeaInfoAction}
        heading={`Té de ${name}`}
        subheading={dayNumber === undefined ? "Sin día" : `Día ${dayNumber}`}
        tea={tea}
        teaId={teaId}
      />
    </div>
  );
}
export default EditTeaInfoDayPage;

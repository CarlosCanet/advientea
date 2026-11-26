import { notFound, redirect } from "next/navigation";

import { editTeaInfoAction } from "@/app/actions/teaInfoActions";
import TeaInfoForm from "@/components/TeaInfoForm";
import { Role } from "@/generated/prisma/enums";
import { getSession, getTeaById, getUsernameAssignedToTea } from "@/lib/dal";
import { userCanEditTea } from "@/lib/services/tea-edit-service";

/** The managers' editor for any tea. A participant edits their own on /my-tea. */
async function EditTeaInfoDayPage({ params }: { params: Promise<{ teaId: string }> }) {
  const { teaId } = await params;
  const session = await getSession();
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
    <div className="flex justify-center px-4 py-6 sm:py-10">
      <TeaInfoForm
        action={editTeaInfoAction}
        heading={`Té de ${name}`}
        subheading={dayNumber === undefined ? "Sin día" : `Día ${dayNumber}`}
        submitLabel="Guardar cambios"
        tea={tea}
        teaId={teaId}
      />
    </div>
  );
}
export default EditTeaInfoDayPage;

import Link from "next/link";
import { redirect } from "next/navigation";

import { saveMyTeaAction } from "@/app/actions/teaInfoActions";
import TeaInfoForm from "@/components/TeaInfoForm";
import { canEditTea } from "@/lib/advientea-rules";
import { getOpenParticipationByUserId, getSession, isParticipationDayPlayed } from "@/lib/dal";

function MyTeaNotice({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col justify-center items-center mx-5 mt-5 gap-3">
      <div className="card w-full max-w-xl bg-neutral text-neutral-content card-xl shadow-sm">
        <div className="card-body items-center text-center gap-4">{children}</div>
      </div>
    </div>
  );
}

export default async function MyTeaPage() {
  const session = await getSession();
  if (!session) {
    redirect("/sign-in");
  }
  const participation = await getOpenParticipationByUserId(session.user.id);
  if (!participation) {
    return (
      <MyTeaNotice>
        <p className="font-display text-2xl">
          Todavía no estás inscrito en ninguna edición. Cuando el Geren<span className="italic">Té</span> te inscriba,
          podrás subir aquí tu té.
        </p>
      </MyTeaNotice>
    );
  }

  const mayEdit = canEditTea(session.user.role, {
    editionStatus: participation.edition.status,
    // A played day only protects a tea that exists: one still missing can be uploaded late.
    isDayPlayed: participation.tea !== null && (await isParticipationDayPlayed(participation.id)),
    isOwn: true,
  });
  if (!mayEdit) {
    return (
      <MyTeaNotice>
        <p className="font-display text-2xl">
          Tu día ya ha abierto y tu té ya no se puede cambiar. Si hay un error, avisa al Geren
          <span className="italic">Té</span>.
        </p>
        {participation.day && (
          <Link className="btn btn-ghost text-neutral-content mt-2" href={`/teaDay/${participation.day.id}`}>
            Ver tu día
          </Link>
        )}
      </MyTeaNotice>
    );
  }

  return (
    <div className="flex justify-center">
      <TeaInfoForm
        action={saveMyTeaAction}
        heading={`Tu té · ${participation.edition.name}`}
        subheading={
          participation.day
            ? `Día ${participation.day.dayNumber}`
            : "Aún no tienes día: el té se queda contigo cuando te lo den."
        }
        tea={participation.tea}
      />
    </div>
  );
}

import { Hourglass, Lock } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { saveMyTeaAction } from "@/app/actions/teaInfoActions";
import TeaInfoForm from "@/components/TeaInfoForm";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { canEditTea } from "@/lib/advientea-rules";
import { getOpenParticipationByUserId, getSession, isParticipationDayPlayed } from "@/lib/dal";

interface MyTeaNoticeProps {
  action?: React.ReactNode;
  children: React.ReactNode;
  icon: React.ReactNode;
  title: string;
}

function MyTeaNotice({ action, children, icon, title }: MyTeaNoticeProps) {
  return (
    <div className="flex flex-col justify-center items-center mx-5 mt-5 gap-3">
      <Empty className="max-w-xl rounded-2xl bg-card p-6 text-card-foreground shadow-sm sm:p-10">
        <EmptyHeader>
          <EmptyMedia variant="icon">{icon}</EmptyMedia>
          <EmptyTitle>
            <h1 className="font-display text-3xl">{title}</h1>
          </EmptyTitle>
          <EmptyDescription className="text-base text-foreground">{children}</EmptyDescription>
        </EmptyHeader>
        {action && <EmptyContent>{action}</EmptyContent>}
      </Empty>
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
      <MyTeaNotice icon={<Hourglass />} title="Sin inscripción">
        Todavía no estás inscrito en ninguna edición. Cuando el Geren<span className="italic">Té</span> te inscriba,
        podrás subir aquí tu té.
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
      <MyTeaNotice
        action={
          participation.day && (
            <Button nativeButton={false} render={<Link href={`/teaDay/${participation.day.id}`} />}>
              Ver tu día
            </Button>
          )
        }
        icon={<Lock />}
        title="Ya no se puede cambiar"
      >
        Tu día ya ha abierto y tu té ya no se puede cambiar. Si hay un error, avisa al Geren
        <span className="italic">Té</span>.
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

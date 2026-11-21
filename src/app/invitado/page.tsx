import type { Metadata } from "next";

import * as Sentry from "@sentry/nextjs";
import { Lock, Unlink } from "lucide-react";
import { cookies } from "next/headers";

import { saveGuestTeaAction } from "@/app/actions/teaInfoActions";
import TeaInfoForm from "@/components/TeaInfoForm";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { getGuestParticipationByToken, isParticipationDayPlayed } from "@/lib/dal";
import { GUEST_COOKIE } from "@/lib/guest-cookie";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
};

function GuestNotice({ children, icon, title }: { children: React.ReactNode; icon: React.ReactNode; title: string }) {
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
      </Empty>
    </div>
  );
}

/** A guest's tea, opened by the cookie their secret link left. The token itself is never rendered. */
export default async function GuestPage() {
  const token = (await cookies()).get(GUEST_COOKIE)?.value;
  const participation = token ? await getGuestParticipationByToken(token) : null;
  if (!participation) {
    return (
      <GuestNotice icon={<Unlink />} title="Enlace no válido">
        Este enlace no es válido o ha caducado. Pide uno nuevo al Geren<span className="italic">Té</span>.
      </GuestNotice>
    );
  }
  // A guest has no account: the participation is what tells their errors apart.
  Sentry.setUser({ id: `guest:${participation.id}` });

  // A played day only protects a tea that exists: one still missing can be uploaded late.
  if (participation.tea !== null && (await isParticipationDayPlayed(participation.id))) {
    return (
      <GuestNotice icon={<Lock />} title="Ya no se puede cambiar">
        Tu día ya ha abierto y tu té ya no se puede cambiar. Si hay un error, avisa al Geren
        <span className="italic">Té</span>.
      </GuestNotice>
    );
  }

  return (
    <div className="flex justify-center">
      <TeaInfoForm
        action={saveGuestTeaAction}
        greeting={`Hola, ${participation.guestName}.`}
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

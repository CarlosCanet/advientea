import type { Metadata } from "next";

import { cookies } from "next/headers";

import { saveGuestTeaAction } from "@/app/actions/teaInfoActions";
import TeaInfoForm from "@/components/TeaInfoForm";
import { getGuestParticipationByToken, isParticipationDayPlayed } from "@/lib/dal";
import { GUEST_COOKIE } from "@/lib/guest-cookie";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
};

function GuestNotice({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col justify-center items-center mx-5 mt-5 gap-3">
      <div className="card w-full max-w-xl bg-neutral text-neutral-content card-xl shadow-sm">
        <div className="card-body items-center text-center gap-4">{children}</div>
      </div>
    </div>
  );
}

/** A guest's tea, opened by the cookie their secret link left. The token itself is never rendered. */
export default async function GuestPage() {
  const token = (await cookies()).get(GUEST_COOKIE)?.value;
  const participation = token ? await getGuestParticipationByToken(token) : null;
  if (!participation) {
    return (
      <GuestNotice>
        <p className="font-[Griffy] text-2xl">
          Este enlace no es válido o ha caducado. Pide uno nuevo al Geren<span className="italic">Té</span>.
        </p>
      </GuestNotice>
    );
  }

  // A played day only protects a tea that exists: one still missing can be uploaded late.
  if (participation.tea !== null && (await isParticipationDayPlayed(participation.id))) {
    return (
      <GuestNotice>
        <p className="font-[Griffy] text-2xl">
          Tu día ya ha abierto y tu té ya no se puede cambiar. Si hay un error, avisa al Geren
          <span className="italic">Té</span>.
        </p>
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

import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { FaAward } from "react-icons/fa6";

import RankingList from "@/components/RankingList";
import { getAdvienteaDayState } from "@/lib/advientea-rules";
import { auth } from "@/lib/auth";
import { getDayById, getEditionInfo } from "@/lib/dal";
import { getDailyRanking } from "@/lib/services/ranking-service";

interface RankingPageProps {
  params: Promise<{ dayId: string }>;
}

export default async function RankingPage({ params }: RankingPageProps) {
  const { dayId } = await params;
  const day = await getDayById(dayId);
  const session = await auth.api.getSession({ headers: await headers() });
  if (!day || !session) {
    notFound();
  }
  const advienteaDayState = getAdvienteaDayState(
    day.dayNumber,
    await getEditionInfo(day.year),
    session.user.role,
    false,
  );
  const ranking = await getDailyRanking(dayId);
  if (!ranking) {
    notFound();
  }
  return (
    <div className="flex flex-col justify-center items-center mx-5 mt-5 gap-3">
      <div className="card w-full max-w-xl bg-neutral text-neutral-content card-xl shadow-sm">
        <div className="card-body items-center">
          <h2 className="card-title text-4xl">
            <FaAward />
            Día {day.dayNumber}
            <FaAward />
          </h2>
          <h2 className="card-title text-lg">Ranking diario</h2>
        </div>
      </div>
      {advienteaDayState.isTeaReleased ? (
        <RankingList currentUserId={session.user.id} ranking={ranking} />
      ) : (
        <div className="bg-base-100 w-full max-w-xl p-5 rounded-2xl justify-center items-center text-center text-xl font-[Griffy]">
          <div className="skeleton skeleton-text text-base-200">El ranking aún no está disponible.</div>
          <div className="skeleton skeleton-text text-base-200">Ten paciencia y vuelve pronto.</div>
        </div>
      )}
    </div>
  );
}

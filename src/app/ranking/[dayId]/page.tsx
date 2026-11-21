import { Award } from "lucide-react";
import { notFound } from "next/navigation";

import PageHeader from "@/components/PageHeader";
import RankingList from "@/components/RankingList";
import { getAdvienteaDayState } from "@/lib/advientea-rules";
import { getDayById, getEditionInfo, getSession } from "@/lib/dal";
import { getDailyRanking } from "@/lib/services/ranking-service";

interface RankingPageProps {
  params: Promise<{ dayId: string }>;
}

export default async function RankingPage({ params }: RankingPageProps) {
  const { dayId } = await params;
  const day = await getDayById(dayId);
  const session = await getSession();
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
      <PageHeader icon={<Award />} subtitle="Ranking diario" title={`Día ${day.dayNumber}`} />
      {advienteaDayState.isTeaReleased ? (
        <RankingList currentUserId={session.user.id} ranking={ranking} />
      ) : (
        <div className="bg-base-100 w-full max-w-xl p-5 rounded-2xl justify-center items-center text-center text-xl font-display">
          <div className="skeleton skeleton-text text-base-200">El ranking aún no está disponible.</div>
          <div className="skeleton skeleton-text text-base-200">Ten paciencia y vuelve pronto.</div>
        </div>
      )}
    </div>
  );
}

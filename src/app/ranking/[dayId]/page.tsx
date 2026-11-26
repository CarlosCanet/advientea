import { cn } from "cn";
import { ArrowLeft, Award } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import PageHeader from "@/components/PageHeader";
import RankingList from "@/components/RankingList";
import RevealLock from "@/components/tea/RevealLock";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getAdvienteaDayState, HOURS, toHourLabel } from "@/lib/advientea-rules";
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
    <div className="mx-auto mt-5 flex w-full max-w-xl flex-col gap-4 px-4 pb-6 lg:max-w-2xl">
      <PageHeader className="max-w-none" icon={<Award />} subtitle="Ranking diario" title={`Día ${day.dayNumber}`} />
      <Link className={cn(buttonVariants({ variant: "outline" }), "self-start bg-card")} href={`/teaDay/${day.id}`}>
        <ArrowLeft data-icon="inline-start" />
        Volver al día {day.dayNumber}
      </Link>
      {advienteaDayState.isTeaReleased ? (
        <RankingList currentUserId={session.user.id} ranking={ranking} />
      ) : (
        <Card className="px-5 text-base">
          {/* An opened day whose tea is still hidden can only be today; any other is still to come. */}
          <RevealLock
            label={
              advienteaDayState.isReleased
                ? `El ranking de hoy se desvela a las ${toHourLabel(HOURS.TEA)}`
                : `El ranking de este día se desvela a las ${toHourLabel(HOURS.TEA)} de ese día`
            }
          />
        </Card>
      )}
    </div>
  );
}

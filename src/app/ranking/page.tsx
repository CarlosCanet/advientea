import { Trophy } from "lucide-react";
import { notFound } from "next/navigation";

import PageHeader from "@/components/PageHeader";
import RankingList from "@/components/RankingList";
import NoActiveEdition from "@/components/states/NoActiveEdition";
import RevealLock from "@/components/tea/RevealLock";
import { Card } from "@/components/ui/card";
import { getAdvienteaDayState, HOURS, toHourLabel } from "@/lib/advientea-rules";
import { getActiveEdition, getEditionInfo, getSession } from "@/lib/dal";
import { getOverallRanking } from "@/lib/services/ranking-service";

export default async function OverallRankingPage() {
  const session = await getSession();
  if (!session) {
    notFound();
  }
  const edition = await getActiveEdition();
  if (!edition) {
    return <NoActiveEdition />;
  }
  const editionInfo = await getEditionInfo(edition.year);
  const advienteaDayState = getAdvienteaDayState(editionInfo.lastDayNumber, editionInfo, session.user.role, false);
  const ranking = await getOverallRanking(edition.year);
  if (!ranking) {
    notFound();
  }
  return (
    <div className="mx-auto mt-5 flex w-full max-w-xl flex-col gap-4 px-4 pb-6 lg:max-w-2xl">
      <PageHeader
        className="max-w-none"
        icon={<Trophy />}
        subtitle={`Ranking ${edition.year}`}
        title="Salón de la Taza"
      />
      {advienteaDayState.isPersonNameReleased ? (
        <RankingList currentUserId={session.user.id} ranking={ranking} />
      ) : (
        <Card className="px-5 text-base">
          <RevealLock label={`El ranking general se desvela el último día a las ${toHourLabel(HOURS.NAME)}`} />
        </Card>
      )}
    </div>
  );
}

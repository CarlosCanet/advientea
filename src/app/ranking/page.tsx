import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { BsCupFill } from "react-icons/bs";
import { FaAward, FaTrophy } from "react-icons/fa6";

import RankingList from "@/components/RankingList";
import NoActiveEdition from "@/components/ui/NoActiveEdition";
import { editionInfoForYear, getAdvienteaDayState } from "@/lib/advientea-rules";
import { auth } from "@/lib/auth";
import { getActiveEdition, getUpcomingEdition } from "@/lib/dal";
import { getOverallRanking } from "@/lib/services/ranking-service";

export default async function OverallRankingPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    notFound();
  }
  const edition = await getActiveEdition();
  if (!edition) {
    return <NoActiveEdition nextYear={(await getUpcomingEdition())?.year} />;
  }
  const today = new Date();
  const advienteaDayState = getAdvienteaDayState(
    today.getDate(),
    editionInfoForYear(edition.year),
    session.user.role,
    false,
  );
  const ranking = await getOverallRanking(edition.year);
  if (!ranking) {
    notFound();
  }
  return (
    <div className="flex flex-col justify-center items-center mx-5 mt-5 gap-3">
      <div className="card w-full max-w-xl bg-neutral text-neutral-content card-xl shadow-sm">
        <div className="card-body items-center">
          <h2 className="card-title text-4xl">
            <FaTrophy />
            Salón de la Taza <BsCupFill />
          </h2>
          <h2 className="card-title text-lg">
            <FaAward /> Ranking {edition.year} <FaAward />
          </h2>
        </div>
      </div>
      {advienteaDayState.isPersonNameReleased ? (
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

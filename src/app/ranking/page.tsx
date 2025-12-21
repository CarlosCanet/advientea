import RankingList from "@/components/RankingList";
import { Role } from "@/generated/prisma/enums";
import { getAdvienteaDayState } from "@/lib/advientea-rules";
import { auth } from "@/lib/auth";
import { getOverallRanking } from "@/lib/services/ranking-service";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { BsCupFill } from "react-icons/bs";
import { FaAward, FaTrophy } from "react-icons/fa6";

export default async function OverallRankingPage() {
  const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      notFound();
  }
  const today = new Date();
  const advienteaDayState = getAdvienteaDayState(today.getDay(), today.getFullYear(), session?.user.role as Role, false);
  const ranking = await getOverallRanking();
  if (!ranking) {
    notFound();
  }
  return (
    <div className="flex flex-col justify-center items-center mx-5 mt-5 gap-3">
      <div className="card w-full max-w-xl bg-neutral text-neutral-content card-xl shadow-sm">
        <div className="card-body items-center">
          <h2 className="card-title text-4xl"><FaTrophy />Salón de la Taza <BsCupFill /></h2>
          <h2 className="card-title text-lg"><FaAward /> Ranking {today.getFullYear()} <FaAward /></h2>
        </div>
      </div>
      {!advienteaDayState.isPersonNameReleased ? (
        <RankingList ranking={ranking} currentUserId={session.user.id}/>
      ) : (
        <div className="bg-base-100 w-full max-w-xl p-5 rounded-2xl justify-center items-center text-center text-xl font-[Griffy]">
          <div className="skeleton skeleton-text text-base-200">El ranking aún no está disponible.</div>
          <div className="skeleton skeleton-text text-base-200">Ten paciencia y vuelve pronto.</div>
        </div>
      )}
      
    </div>
  )
}

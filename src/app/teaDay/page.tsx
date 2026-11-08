import { headers } from "next/headers";
import Link from "next/link";
import { BsCupHot, BsCupHotFill } from "react-icons/bs";

import NoActiveEdition from "@/components/ui/NoActiveEdition";
import TeaInfusionInfo from "@/components/ui/TeaInfusionInfo";
import { Role } from "@/generated/prisma/enums";
import { getAdvienteaDayState, getDaySchedule } from "@/lib/advientea-rules";
import { getNow } from "@/lib/advientea-time";
import { auth } from "@/lib/auth";
import { getActiveEdition, getAllDays, getEditionInfo, getUpcomingEdition } from "@/lib/dal";

export default async function DaysList() {
  const session = await auth.api.getSession({ headers: await headers() });

  const edition = await getActiveEdition();
  if (!edition) {
    return <NoActiveEdition nextYear={(await getUpcomingEdition())?.year} />;
  }

  let days = await getAllDays(edition.year);
  const editionInfo = await getEditionInfo(edition.year);
  if (session?.user.role !== Role.ADMIN && session?.user.role !== Role.EXECUTEAVE) {
    days = days.filter((day) => getDaySchedule(day.dayNumber, editionInfo, getNow()).isReleased);
  }

  return (
    <div className="place-self-center flex flex-col justify-center items-center mt-5 p-5 w-full max-w-xl">
      <ul className="list bg-base-200 rounded-box shadow-md">
        <li className="p-4 pb-2 text-xl font-bold opacity-60 tracking-wide text-center rounded-none border-b border-b-secondary/70">
          Calendario de Advienté{" "}
        </li>
        {days
          .toSorted((day1, day2) => day2.dayNumber - day1.dayNumber)
          .map((day) => {
            const advienteaDayState = getAdvienteaDayState(day.dayNumber, editionInfo, session?.user.role, false);
            const assigneeName = day.assignment?.guestName ?? day.assignment?.user?.username;
            const advienteaDayTitle =
              advienteaDayState.isPersonNameReleased && assigneeName
                ? `${day.tea?.name} - ${assigneeName}`
                : day.tea?.name;
            return (
              <li className="rounded-none border-b border-b-secondary/70" key={day.id}>
                <Link className="list-row items-center justify-center text-center gap-1 " href={`/teaDay/${day.id}`}>
                  <div className="flex flex-col items-center rounded-lg shadow-md overflow-hidden border border-base-200">
                    {/* Calendar header */}
                    <div className="w-full h-2 bg-secondary"></div>

                    {/* Calendar day */}
                    <div className="flex items-center justify-center px-2 py-2 ">
                      <span className="text-lg font-bold text-base-content tabular-nums leading-none">
                        {day.dayNumber.toString().padStart(2, "0")}
                      </span>
                    </div>
                  </div>
                  <div className="list-col-grow">
                    {advienteaDayState.isTeaReleased ? (
                      <div className="font-[Griffy] text-md">{advienteaDayTitle}</div>
                    ) : (
                      <div className="skeleton skeleton-text font-[Griffy] text-lg">Té desconocido</div>
                    )}
                    {day.tea && advienteaDayState.isPart1Released && (
                      <TeaInfusionInfo hasMoreIndication={false} tea={day.tea} xs={true} />
                    )}
                  </div>
                  <div className="text-2xl">{day.dayNumber % 2 === 0 ? <BsCupHot /> : <BsCupHotFill />}</div>
                </Link>
              </li>
            );
          })}
      </ul>
    </div>
  );
}

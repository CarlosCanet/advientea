import TeaInfusionInfo from "@/components/ui/TeaInfusionInfo";
import { Role } from "@/generated/prisma/enums";
import { getAdvienteaDayState, isDateTodayOrPast } from "@/lib/advientea-rules";
import { auth } from "@/lib/auth";
import { getAllDays } from "@/lib/dal";
import { headers } from "next/headers";
import Link from "next/link";
import { BsCupHot, BsCupHotFill } from "react-icons/bs";
import { MdBackHand } from "react-icons/md";

export default async function DaysList() {
  const session = await auth.api.getSession({ headers: await headers() });
  let days = await getAllDays(2025);
  const lastDay = days[days.length - 1];
  const isNameReleased = isDateTodayOrPast(new Date(lastDay.year, 11, lastDay.dayNumber));

  if (session?.user.role !== Role.ADMIN && session?.user.role !== Role.EXECUTEAVE) {
    days = days.filter((day) => isDateTodayOrPast(new Date(day.year, 11, day.dayNumber)));
  }

  return (
    <div className="place-self-center flex flex-col justify-center items-center mt-5 p-5 w-full max-w-xl">
      <ul className="list bg-base-200 rounded-box shadow-md">
        <li className="p-4 pb-2 text-xl font-bold opacity-60 tracking-wide text-center rounded-none border-b border-b-secondary/70">
          Calendario de Advienté{" "}
        </li>
        {days.length === 0 && (
          <li className="list-row items-center justify-center text-center gap-1 rounded-none border-b border-b-secondary/70">
            {/* <div className="text-4xl font-thin opacity-30 tabular-nums">{day.dayNumber.toString().padStart(2, "0")}</div> */}
            <div className="flex flex-col items-center rounded-lg shadow-md overflow-hidden border border-base-200">
              {/* Calendar header */}
              <div className="w-full h-2 bg-secondary"></div>

              {/* Calendar day */}
              <div className="flex items-center justify-center px-2 py-2 ">
                <span className="text-lg font-bold text-base-content tabular-nums leading-none">00</span>
              </div>
            </div>
            <div className="list-col-grow">
              <div className="font-[Griffy] text-lg">Vuelve el 1 de <br /> diciembre de 2025</div>
            </div>
              <MdBackHand />
          </li>
        )}
        {days.toSorted((day1,day2) => day2.dayNumber - day1.dayNumber).map((day) => {
          const advienteaDayState = getAdvienteaDayState(day.dayNumber, day.year, session?.user.role as Role, false);
          const assigneeName = day.assignment?.guestName ?? day.assignment?.user?.username;
          const advienteaDayTitle = isNameReleased && assigneeName ? `${day.tea?.name} - ${assigneeName}` : day.tea?.name;
          return (
            <li key={day.id} className="rounded-none border-b border-b-secondary/70">
              <Link href={`teaDay/${day.id}`} className="list-row items-center justify-center text-center gap-1 ">
                <div className="flex flex-col items-center rounded-lg shadow-md overflow-hidden border border-base-200">
                  {/* Calendar header */}
                  <div className="w-full h-2 bg-secondary"></div>

                  {/* Calendar day */}
                  <div className="flex items-center justify-center px-2 py-2 ">
                    <span className="text-lg font-bold text-base-content tabular-nums leading-none">{day.dayNumber.toString().padStart(2, "0")}</span>
                  </div>
                </div>
                <div className="list-col-grow">
                  {advienteaDayState.isTeaReleased ? (
                    <div className="font-[Griffy] text-md">{advienteaDayTitle}</div>
                  ): (
                    <div className="skeleton skeleton-text font-[Griffy] text-lg">Té desconocido</div>
                  )}
                  {day.tea && advienteaDayState.isPart1Released &&
                    <TeaInfusionInfo tea={day.tea} hasMoreIndication={false} xs={true} />
                  }
                </div>
                <div className="text-2xl">
                  {day.dayNumber % 2 === 0 ? <BsCupHot /> : <BsCupHotFill />}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

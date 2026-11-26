import { cn } from "cn";
import { Lock } from "lucide-react";
import Link from "next/link";

import PageHeader from "@/components/PageHeader";
import NoActiveEdition from "@/components/states/NoActiveEdition";
import { Badge } from "@/components/ui/badge";
import { Role } from "@/generated/prisma/enums";
import { getAdvienteaDayState, getDaySchedule, HOURS, toHourLabel } from "@/lib/advientea-rules";
import { getNow } from "@/lib/advientea-time";
import { getActiveEdition, getAllDays, getEditionInfo, getSession } from "@/lib/dal";
import { getTodayDayNumber } from "@/lib/day-view";

export default async function DaysList() {
  const session = await getSession();

  const edition = await getActiveEdition();
  if (!edition) {
    return <NoActiveEdition />;
  }

  let days = await getAllDays(edition.year);
  const editionInfo = await getEditionInfo(edition.year);
  const now = getNow();
  if (session?.user.role !== Role.ADMIN && session?.user.role !== Role.EXECUTEAVE) {
    days = days.filter((day) => getDaySchedule(day.dayNumber, editionInfo, now).isReleased);
  }
  const todayDayNumber = getTodayDayNumber(editionInfo, now);
  const revealTime = toHourLabel(HOURS.TEA);

  return (
    <div className="mx-auto mt-5 flex w-full max-w-xl flex-col items-center gap-3 px-4 pb-5 sm:px-5 lg:max-w-4xl">
      <PageHeader className="lg:max-w-none" title="Calendario de Advienté" />
      <ol className="grid w-full grid-cols-3 gap-2 rounded-2xl bg-card p-2 text-card-foreground shadow-sm ring-1 ring-foreground/10 sm:grid-cols-4 sm:gap-3 sm:p-3 lg:grid-cols-5">
        {days
          .toSorted((day1, day2) => day1.dayNumber - day2.dayNumber)
          .map((day) => {
            const advienteaDayState = getAdvienteaDayState(day.dayNumber, editionInfo, session?.user.role, false);
            const isToday = day.dayNumber === todayDayNumber;
            const teaName = day.participation?.tea?.name ?? "Falta el té";
            return (
              <li key={day.id}>
                <Link
                  aria-current={isToday ? "date" : undefined}
                  className={cn(
                    "flex h-full min-h-28 flex-col items-center gap-1 rounded-xl px-2 pt-3 pb-2.5 text-center ring-1 ring-foreground/10 transition-colors outline-none focus-visible:focus-ring motion-reduce:transition-none",
                    isToday ? "bg-honey text-honey-foreground hover:bg-honey/85" : "bg-popover hover:bg-muted",
                    !advienteaDayState.isReleased && "bg-transparent text-muted-foreground ring-foreground/20",
                  )}
                  href={`/teaDay/${day.id}`}
                >
                  <span className="font-display text-4xl leading-none tabular-nums">
                    <span className="sr-only">Día </span>
                    {day.dayNumber}
                    <span className="sr-only">, </span>
                  </span>
                  {isToday && (
                    <Badge className="bg-honey-foreground text-honey">
                      Hoy<span className="sr-only">, </span>
                    </Badge>
                  )}
                  {!advienteaDayState.isReleased ? (
                    <span className="mt-auto flex items-center gap-1 text-xs">
                      <Lock aria-hidden="true" className="size-3.5 shrink-0" />
                      Sin abrir
                    </span>
                  ) : advienteaDayState.isTeaReleased ? (
                    <span className="mt-auto line-clamp-2 text-sm font-semibold break-words">{teaName}</span>
                  ) : (
                    <span className="mt-auto flex items-center gap-1 text-xs font-medium">
                      <Lock aria-hidden="true" className="size-3.5 shrink-0" />
                      <span className="sr-only">el té se desvela a las </span>
                      {revealTime}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
      </ol>
    </div>
  );
}

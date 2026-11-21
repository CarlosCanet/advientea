import { ChevronRight } from "lucide-react";
import Link from "next/link";

import PageHeader from "@/components/PageHeader";
import NoActiveEdition from "@/components/states/NoActiveEdition";
import RevealLock from "@/components/tea/RevealLock";
import TeaInfusionInfo from "@/components/tea/TeaInfusionInfo";
import { Item, ItemActions, ItemContent, ItemMedia, ItemTitle } from "@/components/ui/item";
import { Role } from "@/generated/prisma/enums";
import { getAdvienteaDayState, getDaySchedule, HOURS, toHourLabel } from "@/lib/advientea-rules";
import { getNow } from "@/lib/advientea-time";
import { getActiveEdition, getAllDays, getEditionInfo, getSession } from "@/lib/dal";
import { toParticipantName } from "@/lib/utils";

export default async function DaysList() {
  const session = await getSession();

  const edition = await getActiveEdition();
  if (!edition) {
    return <NoActiveEdition />;
  }

  let days = await getAllDays(edition.year);
  const editionInfo = await getEditionInfo(edition.year);
  if (session?.user.role !== Role.ADMIN && session?.user.role !== Role.EXECUTEAVE) {
    days = days.filter((day) => getDaySchedule(day.dayNumber, editionInfo, getNow()).isReleased);
  }
  const revealTime = toHourLabel(HOURS.TEA);

  return (
    <div className="mx-auto mt-5 flex w-full max-w-xl flex-col items-center gap-3 px-4 pb-5 sm:px-5">
      <PageHeader title="Calendario de Advienté" />
      <ul className="flex w-full flex-col gap-1 rounded-2xl bg-card p-2 text-card-foreground shadow-sm ring-1 ring-foreground/10">
        {days
          .toSorted((day1, day2) => day2.dayNumber - day1.dayNumber)
          .map((day) => {
            const advienteaDayState = getAdvienteaDayState(day.dayNumber, editionInfo, session?.user.role, false);
            const assigneeName = day.participation ? toParticipantName(day.participation) : null;
            const tea = day.participation?.tea ?? null;
            const teaTitle = tea?.name ?? "Falta el té";
            const advienteaDayTitle =
              advienteaDayState.isPersonNameReleased && assigneeName ? `${teaTitle} - ${assigneeName}` : teaTitle;
            return (
              <li key={day.id}>
                <Item className="items-start px-3" render={<Link href={`/teaDay/${day.id}`} />}>
                  <ItemMedia className="w-14 flex-col gap-0 overflow-hidden rounded-lg bg-popover shadow-sm ring-1 ring-foreground/10">
                    <span aria-hidden="true" className="h-2 w-full bg-brand" />
                    <span className="py-2 font-display text-2xl leading-none tabular-nums">
                      <span className="sr-only">Día </span>
                      {day.dayNumber.toString().padStart(2, "0")}
                    </span>
                  </ItemMedia>
                  <ItemContent className="min-w-0">
                    {advienteaDayState.isTeaReleased ? (
                      <ItemTitle className="line-clamp-2 text-base font-semibold">{advienteaDayTitle}</ItemTitle>
                    ) : (
                      <RevealLock
                        detail={
                          advienteaDayState.isReleased
                            ? `Se revela a las ${revealTime}`
                            : `Se revela el día ${day.dayNumber} a las ${revealTime}`
                        }
                        label="Té desconocido"
                      />
                    )}
                    {tea && advienteaDayState.isPart1Released && (
                      <TeaInfusionInfo hasMoreIndication={false} tea={tea} xs={true} />
                    )}
                  </ItemContent>
                  <ItemActions className="self-center">
                    <ChevronRight aria-hidden="true" className="size-5 text-muted-foreground" />
                  </ItemActions>
                </Item>
              </li>
            );
          })}
      </ul>
    </div>
  );
}

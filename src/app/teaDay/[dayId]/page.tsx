import { cn } from "cn";
import { ChevronDown, Coffee, Globe, Store } from "lucide-react";
import { notFound } from "next/navigation";

import PageHeader from "@/components/PageHeader";
import WaitForDayToCome from "@/components/states/WaitForDayToCome";
import StoryTeaComponent from "@/components/StoryTeaComponent";
import AuthorName from "@/components/tea/AuthorName";
import RevealLock from "@/components/tea/RevealLock";
import RevealStrip from "@/components/tea/RevealStrip";
import TeaInfusionInfo from "@/components/tea/TeaInfusionInfo";
import TeaGuessCard from "@/components/TeaGuessCard";
import Timer from "@/components/Timer";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { getAdvienteaDayState, HOURS, toHourLabel } from "@/lib/advientea-rules";
import { getDayById, getEditionInfo, getSession, getUsernameAssignedToTea } from "@/lib/dal";
import { getRevealSteps } from "@/lib/day-view";

interface TeaDayPageProps {
  params: Promise<{ dayId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

/** The store link as people read it: the site, not the whole address. */
function toHostname(url: string): string {
  try {
    return new URL(url).hostname || url;
  } catch {
    return url;
  }
}

export default async function TeaDayPage({ params, searchParams }: TeaDayPageProps) {
  const { dayId } = await params;
  const day = await getDayById(dayId);
  if (!day) {
    notFound();
  }
  const simulated = Boolean((await searchParams).simulated);
  const tea = day.participation?.tea ?? null;
  const session = await getSession();
  const advienteaDayState = getAdvienteaDayState(
    day.dayNumber,
    await getEditionInfo(day.year),
    session?.user.role,
    simulated,
  );
  if (!advienteaDayState.isReleased) {
    return <WaitForDayToCome dayNumber={day.dayNumber} year={day.year} />;
  }
  const userName = tea && advienteaDayState.isPersonNameReleased ? await getUsernameAssignedToTea(tea.id) : "";

  const hasStory = Boolean(tea?.story);

  return (
    <div className={cn("mx-auto mt-5 w-full max-w-xl px-4 pb-5 sm:px-5", hasStory && "lg:max-w-5xl")}>
      {/* Day + Tea name */}
      <PageHeader
        className="max-w-none"
        subtitle={advienteaDayState.isTeaReleased ? tea?.name : "Té desconocido"}
        title={`Día ${day.dayNumber}`}
      >
        {session && advienteaDayState.isPersonNameReleased && <AuthorName name={userName} />}
      </PageHeader>

      <div
        className={cn(
          "mt-3 grid grid-cols-1 gap-3",
          hasStory && "lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:items-start lg:gap-5",
        )}
      >
        {/* Phones read it before the story; on desktop it is the right column. */}
        <div className={cn("flex min-w-0 flex-col gap-3", hasStory && "lg:col-start-2 lg:row-start-1")}>
          <RevealStrip steps={getRevealSteps(advienteaDayState)} />

          <TeaGuessCard dayId={day.id} />

          {!tea ? (
            <Card className="w-full px-5 text-center text-base">
              <div>
                <p>Falta el té de este día.</p>
                <p>Ten paciencia y vuelve pronto.</p>
              </div>
            </Card>
          ) : (
            <Card className="w-full gap-0 py-0">
              <Collapsible defaultOpen={true}>
                <h2>
                  <CollapsibleTrigger className="group/trigger flex min-h-11 w-full items-center gap-3 rounded-2xl px-5 py-4 text-left outline-none focus-visible:focus-ring">
                    <ChevronDown
                      aria-hidden="true"
                      className="size-5 shrink-0 transition-transform group-data-panel-open/trigger:rotate-180 motion-reduce:transition-none"
                    />
                    <span className="font-display text-3xl">
                      Informa<span className="italic">Té</span>
                    </span>
                  </CollapsibleTrigger>
                </h2>
                <CollapsibleContent className="px-5 pb-5 text-sm" keepMounted={true}>
                  {advienteaDayState.isPart1Released ? (
                    <div className="flex flex-col gap-4">
                      <section className="flex flex-col gap-2">
                        <h3 className="flex items-center gap-2 text-lg font-semibold">
                          <Coffee aria-hidden="true" className="size-5" />
                          ¿Cómo infusionar?
                        </h3>
                        <TeaInfusionInfo tea={tea} />
                        <Timer seconds={(tea?.infusionTime ?? 0) * 60} />
                      </section>

                      {advienteaDayState.isTeaReleased && (tea?.storeName || tea?.url) && (
                        <section className="flex flex-col gap-2">
                          <h3 className="flex items-center gap-2 text-lg font-semibold">
                            <Store aria-hidden="true" className="size-5" />
                            ¿Dónde comprar?
                          </h3>
                          {tea.storeName && (
                            <p className="ml-7 flex items-center gap-2 text-base">
                              <Store aria-hidden="true" className="size-4 shrink-0" />
                              {tea.storeName}
                            </p>
                          )}
                          {tea.url && (
                            <a
                              className="ml-7 flex items-center gap-2 text-base break-all underline underline-offset-4 pointer-coarse:min-h-11"
                              href={tea.url}
                              rel="noopener noreferrer"
                              target="_blank"
                            >
                              <Globe aria-hidden="true" className="size-4 shrink-0" />
                              {toHostname(tea.url)}
                            </a>
                          )}
                        </section>
                      )}
                    </div>
                  ) : (
                    <RevealLock
                      className="text-base"
                      detail={`Se revela a las ${toHourLabel(HOURS.PART1)}`}
                      label="No es la hora todavía..."
                    />
                  )}
                </CollapsibleContent>
              </Collapsible>
            </Card>
          )}
        </div>

        {tea?.story && (
          <div className="min-w-0 lg:col-start-1 lg:row-start-1">
            <StoryTeaComponent
              isPart1Released={advienteaDayState.isPart1Released}
              isPart2Released={advienteaDayState.isPart2Released}
              isPart3Released={advienteaDayState.isPart3Released}
              story={tea.story}
            />
          </div>
        )}
      </div>
    </div>
  );
}

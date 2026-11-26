import type { StoryTeaWithImages } from "@/lib/dal";

import CarouselComponent from "@/components/tea/CarouselComponent";
import RevealLock from "@/components/tea/RevealLock";
import TimelineIcon from "@/components/tea/TimelineIcon";
import { Card } from "@/components/ui/card";
import { HOURS, toHourLabel } from "@/lib/advientea-rules";
import { getYouTubeId } from "@/lib/utils";

import YoutubeComponent from "./YoutubeComponent";

interface StoryTeaComponentProps {
  isPart1Released: boolean;
  isPart2Released: boolean;
  isPart3Released: boolean;
  story: StoryTeaWithImages;
}
export default function StoryTeaComponent({
  isPart1Released,
  isPart2Released,
  isPart3Released,
  story,
}: StoryTeaComponentProps) {
  // const videoId = "GFfn8L2saYI";
  const videoId = story.youtubeURL ? getYouTubeId(story.youtubeURL) : null;
  const parts = [
    { hour: HOURS.PART1, isReleased: isPart1Released, number: 1, text: story.storyPart1 },
    { hour: HOURS.PART2, isReleased: isPart2Released, number: 2, text: story.storyPart2 },
    { hour: HOURS.PART3, isReleased: isPart3Released, number: 3, text: story.storyPart3 },
  ].filter((part) => part.text);
  return (
    <Card className="w-full gap-5 px-5 shadow-sm">
      <h2 className="text-2xl font-semibold tracking-tight">Ambientación</h2>
      {!isPart1Released && parts.length === 0 && (
        <RevealLock
          className="text-base"
          detail={`Se revela a las ${toHourLabel(HOURS.PART1)}`}
          label="No es la hora todavía..."
        />
      )}
      {isPart1Released && <CarouselComponent images={story.images} />}
      {parts.length > 0 && (
        <ol className="ms-3 border-s-2 border-brand/40">
          {parts.map((part) =>
            part.isReleased ? (
              <li className="relative ps-7 pb-8 last:pb-1" key={part.hour}>
                <span className="absolute -start-[13px] top-0 flex size-6 items-center justify-center rounded-full bg-card text-brand">
                  <TimelineIcon />
                </span>
                <time className="text-sm font-semibold" dateTime={toHourLabel(part.hour)}>
                  {toHourLabel(part.hour)} h
                </time>
                <div className="mt-1 text-base leading-relaxed whitespace-pre-wrap">{part.text}</div>
              </li>
            ) : (
              <li className="relative ps-7 pb-8 last:pb-1" key={part.hour}>
                <span
                  aria-hidden="true"
                  className="absolute -start-[7px] top-1.5 size-3 rounded-full bg-card ring-2 ring-muted-foreground/50"
                />
                <RevealLock
                  className="text-base"
                  label={`La parte ${part.number} se desvela a las ${toHourLabel(part.hour)}`}
                />
              </li>
            ),
          )}
        </ol>
      )}
      {isPart1Released && story.youtubeURL && (
        <YoutubeComponent
          youtubeURL={`https://www.youtube.com/embed/${videoId}?autoplay=0&loop=1&playlist=${videoId}&iv_load_policy=3`}
        />
      )}
    </Card>
  );
}

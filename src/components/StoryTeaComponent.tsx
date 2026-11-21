import { Suspense } from "react";

import type { StoryTeaWithImages } from "@/lib/dal";

import CarouselComponent from "@/components/tea/CarouselComponent";
import TimelineIcon from "@/components/tea/TimelineIcon";
import { Spinner } from "@/components/ui/spinner";
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
  return (
    <div className="card bg-base-100 w-full max-w-xl card-lg shadow-md">
      <div className="card-body items-center">
        <h2 className="card-title self-start font-semibold text-4xl">Ambientación</h2>
        {!isPart1Released && (
          <div className="skeleton skeleton-text font-display text-2xl">No es la hora todavía...</div>
        )}
        {isPart1Released && <CarouselComponent images={story.images} />}
        <ul className="timeline timeline-snap-icon max-md:timeline-compact timeline-vertical">
          {story.storyPart1 && isPart1Released && (
            <li>
              <div className="timeline-middle">
                <TimelineIcon />
              </div>
              <div className="timeline-start mb-10 md:text-end">
                <time className="font-mono italic">08:00 h</time>
                {<div className="font-display text-justify whitespace-pre-wrap mt-1">{story.storyPart1}</div>}
              </div>
              <hr />
            </li>
          )}
          {story.storyPart2 && isPart2Released && (
            <li>
              {story.storyPart1 && <hr />}
              <div className="timeline-middle">
                <TimelineIcon />
              </div>
              <div className="timeline-end md:mb-10">
                <time className="font-mono italic">13:00 h</time>
                {<div className="font-display text-justify whitespace-pre-wrap mt-1">{story.storyPart2}</div>}
              </div>
              <hr />
            </li>
          )}
          {story.storyPart3 && isPart3Released && (
            <li>
              {story.storyPart3 && <hr />}
              <div className="timeline-middle">
                <TimelineIcon />
              </div>
              <div className="timeline-start mb-10 md:text-end">
                <time className="font-mono italic">18:00 h</time>
                {<div className="font-display text-justify whitespace-pre-wrap mt-1">{story.storyPart3}</div>}
              </div>
              <hr />
            </li>
          )}
        </ul>
        {isPart1Released && story.youtubeURL && (
          <div className="w-full mt-2 border-neutral border-8 rounded-box">
            <Suspense fallback={<Spinner className="size-8" />}>
              <YoutubeComponent
                youtubeURL={`https://www.youtube.com/embed/${videoId}?autoplay=0&loop=1&playlist=${videoId}&iv_load_policy=3`}
              />
            </Suspense>
          </div>
        )}
        <div className="justify-end card-actions"></div>
      </div>
    </div>
  );
}

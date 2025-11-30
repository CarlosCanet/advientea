import { Prisma } from "@/generated/prisma/client";
import TimelineIcon from "./ui/TimelineIcon";
import { Suspense } from "react";
import YoutubeComponent from "./YoutubeComponent";
import { getYouTubeId } from "@/lib/utils";
import CarouselComponent from "./ui/CarouselComponent";

interface StoryTeaComponentProps {
  story: Prisma.StoryTeaGetPayload<{ include: { images: true } }>;
  isPart1Released: boolean;
  isPart2Released: boolean;
  isPart3Released: boolean;
}
export default function StoryTeaComponent({ story, isPart1Released, isPart2Released, isPart3Released }: StoryTeaComponentProps) {
  // const videoId = "GFfn8L2saYI";
  const videoId = story.youtubeURL ? getYouTubeId(story.youtubeURL) : null;
  return (
    <div className="card bg-base-100 w-full max-w-xl card-lg shadow-md">
      <div className="card-body items-center">
        <h2 className="card-title self-start font-semibold text-4xl">Ambientación</h2>
        {!isPart1Released && <div className="skeleton skeleton-text font-[Griffy] text-3xl">No es la hora todavía...</div>}
        {isPart1Released && <CarouselComponent images={story.images} />}
        <ul className="timeline timeline-snap-icon max-md:timeline-compact timeline-vertical">
          {story.storyPart1 && isPart1Released && (
            <li>
              <div className="timeline-middle"><TimelineIcon /></div>
              <div className="timeline-start mb-10 md:text-end">
                <time className="font-mono italic">08:00 h</time>
                {<div className="font-[Griffy] text-justify whitespace-pre-wrap mt-1">{story.storyPart1}</div>}
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
                {<div className="font-[Griffy] text-justify whitespace-pre-wrap mt-1">{story.storyPart2}</div>}
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
                {<div className="font-[Griffy] text-justify whitespace-pre-wrap mt-1">{story.storyPart3}</div>}
              </div>
              <hr />
            </li>
          )}
        </ul>
        {isPart1Released && story.youtubeURL && (
          <div className="w-full mt-2 border-neutral border-8 rounded-box">
            <Suspense fallback={<span className="loading loading-dots loading-xl text-primary"></span>}>
              <YoutubeComponent youtubeURL={`https://www.youtube.com/embed/${videoId}?autoplay=0&loop=1&playlist=${videoId}&iv_load_policy=3`} />
            </Suspense>
          </div>
        )}
        <div className="justify-end card-actions"></div>
      </div>
    </div>
  );
}

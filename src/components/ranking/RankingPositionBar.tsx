"use client";

import { cn } from "cn";
import { LocateFixed } from "lucide-react";
import { useEffect, useState } from "react";

interface RankingPositionBarProps {
  label: string;
  targetId: string;
}

// A row under the fixed navbar (h-16) is not in view.
const VIEWPORT_MARGIN = "-64px 0px 0px 0px";

/** The current user's place, stuck to the bottom of the screen while their row is out of view. */
export default function RankingPositionBar({ label, targetId }: RankingPositionBarProps) {
  // Starts shown, so the server render (and a page without JavaScript) has the bar.
  const [isTargetInView, setIsTargetInView] = useState(false);

  useEffect(() => {
    const target = document.getElementById(targetId);
    if (!target) {
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsTargetInView(entry.isIntersecting);
      },
      { rootMargin: VIEWPORT_MARGIN },
    );
    observer.observe(target);
    return () => {
      observer.disconnect();
    };
  }, [targetId]);

  // Following the fragment scrolls but leaves focus on the link; keyboard and screen reader users must land on the row.
  function focusTarget() {
    document.getElementById(targetId)?.focus({ preventScroll: true });
  }

  return (
    // `invisible` instead of unmounting keeps the page height steady while scrolling.
    // A brand surface around the link keeps its white focus outline on dark green, not on the leaves.
    <div
      className={cn(
        "sticky bottom-[max(1rem,env(safe-area-inset-bottom))] z-10 rounded-2xl bg-brand p-1.5 text-brand-foreground shadow-lg",
        isTargetInView && "invisible",
      )}
    >
      <a
        className="flex min-h-11 items-center gap-2 rounded-xl px-3 text-base font-semibold focus-visible:focus-ring"
        href={`#${targetId}`}
        onClick={focusTarget}
      >
        <LocateFixed aria-hidden="true" className="size-5 shrink-0" />
        <span className="tabular-nums">{label}</span>
      </a>
    </div>
  );
}

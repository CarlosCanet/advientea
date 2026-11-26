import { cn } from "cn";
import { Check, Clock, Lock } from "lucide-react";

import type { RevealStep } from "@/lib/day-view";

interface RevealStripProps {
  steps: RevealStep[];
}

/** The day's schedule at a glance: what is out, what comes next and what is still locked. */
export default function RevealStrip({ steps }: RevealStripProps) {
  return (
    <ol
      aria-label="Horario del día"
      className="grid w-full grid-cols-4 gap-1.5 rounded-2xl bg-card p-2 text-card-foreground shadow-sm ring-1 ring-foreground/10"
    >
      {steps.map((step) => {
        const Icon = step.isReleased ? Check : step.isNext ? Clock : Lock;
        return (
          <li
            className={cn(
              "flex min-w-0 flex-col items-center gap-0.5 rounded-xl px-1 py-2 text-center",
              step.isReleased && "text-foreground",
              step.isNext && "bg-popover font-semibold text-foreground ring-2 ring-foreground",
              !step.isReleased && !step.isNext && "text-muted-foreground",
            )}
            key={step.hour}
          >
            <Icon aria-hidden="true" className="size-4 shrink-0" />
            <time className="text-sm font-semibold tabular-nums" dateTime={step.label}>
              {step.label}
            </time>
            <span className="text-xs leading-tight">
              {step.title}
              <span className="sr-only">
                {step.isReleased ? ", desvelado" : step.isNext ? ", el siguiente" : ", pendiente"}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

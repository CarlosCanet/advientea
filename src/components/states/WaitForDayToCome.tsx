import { CalendarDays } from "lucide-react";
import Link from "next/link";

import PageHeader from "@/components/PageHeader";
import { buttonVariants } from "@/components/ui/button";
import { toDayOpeningLabel } from "@/lib/day-view";

interface WaitForDayToComeProps {
  dayNumber: number;
  year: number;
}
export default function WaitForDayToCome({ dayNumber, year }: WaitForDayToComeProps) {
  return (
    <div className="mx-auto mt-5 flex w-full max-w-xl flex-col items-center gap-4 px-4 pb-5 sm:px-5">
      <PageHeader subtitle={toDayOpeningLabel(year, dayNumber)} title={`Día ${dayNumber}`} />
      <Link className={buttonVariants({ className: "bg-card", variant: "outline" })} href="/teaDay">
        <CalendarDays data-icon="inline-start" />
        Volver al calendario
      </Link>
    </div>
  );
}

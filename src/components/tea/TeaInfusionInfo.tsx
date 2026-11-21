import { Clock, Info, Milk, MilkOff, Repeat, Thermometer, Zap, ZapOff } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Tea } from "@/generated/prisma/client";

interface TeaInfusionInfoProps {
  hasMoreIndication?: boolean;
  tea: Tea;
  xs?: boolean;
}
export default function TeaInfusionInfo({ hasMoreIndication = true, tea, xs = false }: TeaInfusionInfoProps) {
  // The list view keeps the badge's own text-xs; the day page reads at text-sm.
  const badgeSize = xs ? "" : "h-6 px-2.5 text-sm [&>svg]:size-3.5!";
  return (
    <>
      <div className="flex gap-1.5 flex-wrap justify-evenly my-2 ml-4">
        <Badge className={badgeSize} variant="outline">
          <Thermometer />
          {tea.temperature} °C
        </Badge>
        <Badge className={badgeSize} variant="outline">
          <Clock />
          {tea.infusionTime} min
        </Badge>
        {tea.addMilk ? (
          <Badge className={badgeSize} variant="outline">
            <Milk />
            Con leche
          </Badge>
        ) : (
          <Badge className={badgeSize} variant="outline">
            <MilkOff />
            Sin leche
          </Badge>
        )}
        {tea?.hasTheine ? (
          <Badge className={badgeSize} variant="outline">
            <Zap />
            Con teína
          </Badge>
        ) : (
          <Badge className={badgeSize} variant="outline">
            <ZapOff />
            Sin teína
          </Badge>
        )}
        {tea?.canReinfuse && (
          <Badge className={badgeSize} variant="outline">
            <Repeat />
            Reinfusiona {tea.reinfuseNumber} veces
          </Badge>
        )}
      </div>
      {hasMoreIndication && tea.moreIndications && (
        <div className="flex gap-2 items-center text-lg ml-4">
          <Info />
          {tea.moreIndications}
        </div>
      )}
    </>
  );
}

import { Tea } from "@/generated/prisma/client";
import { FaClock } from "react-icons/fa";
import { FaRepeat, FaTemperatureFull } from "react-icons/fa6";
import { GiMilkCarton } from "react-icons/gi";
import { LuZap, LuZapOff } from "react-icons/lu";
import { MdMore } from "react-icons/md";

interface TeaInfusionInfoProps {
  tea: Tea;
  hasMoreIndication?: boolean;
  xs?: boolean;
}
export default function TeaInfusionInfo({ tea, hasMoreIndication = true, xs = false }: TeaInfusionInfoProps) {
  return (
    <>
      <div className="flex gap-1.5 flex-wrap justify-evenly my-2 ml-4">
        <div className={`badge badge-error ${xs ? "badge-xs" : ""}`}>
          <FaTemperatureFull />
          {tea.temperature} ºC
        </div>
        <div className={`badge badge-secondary ${xs ? "badge-xs" : ""}`}>
          <FaClock />
          {tea.infusionTime} min
        </div>
        {tea.addMilk ? (
          <div className={`badge badge-info ${xs ? "badge-xs" : ""}`}>
            <GiMilkCarton />
            Con leche
          </div>
        ) : (
          <div className={`badge ${xs ? "badge-xs" : ""}`}>
            <GiMilkCarton />
            Sin leche
          </div>
        )}
        {tea?.hasTheine ? (
          <div className={`badge badge-warning ${xs ? "badge-xs" : ""}`}>
            <LuZap />
            Con teína
          </div>
        ) : (
          <div className={`badge ${xs ? "badge-xs" : ""}`}>
            <LuZapOff />
            Sin teína
          </div>
        )}
        {tea?.canReinfuse && (
          <div className={`badge badge-neutral ${xs ? "badge-xs" : ""}`}>
            <FaRepeat />
            Reinfusiona {tea.reinfuseNumber} veces
          </div>
        )}
      </div>
      {hasMoreIndication && tea.moreIndications && (
        <div className="flex gap-2 items-center text-lg ml-4">
          <MdMore />
          {tea.moreIndications}
        </div>
      )}
    </>
  );
}
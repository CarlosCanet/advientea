import PageHeader from "@/components/PageHeader";

interface WaitForDayToComeProps {
  dayNumber: number;
}
export default function WaitForDayToCome({ dayNumber }: WaitForDayToComeProps) {
  return (
    <div className="flex flex-col justify-center items-center mx-5 mt-5 gap-3">
      {/* Day + Tea name */}
      <PageHeader subtitle={`Vuelve el día ${dayNumber}`} title={`Día ${dayNumber}`} />
    </div>
  );
}

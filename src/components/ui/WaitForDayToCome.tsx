interface WaitForDayToComeProps {
  dayNumber: number;
}
export default function WaitForDayToCome({ dayNumber }: WaitForDayToComeProps) {
  return (
    <div className="flex flex-col justify-center items-center mx-5 mt-5 gap-3">
      {/* Day + Tea name */}
      <div className="card w-full max-w-xl bg-neutral text-neutral-content card-xl shadow-sm">
        <div className="card-body items-center">
          <h2 className="card-title text-4xl">Día {dayNumber}</h2>
          <div className="font-[Griffy] text-2xl">Vuelve el día {dayNumber}</div>
        </div>
      </div>
    </div>
  )
}
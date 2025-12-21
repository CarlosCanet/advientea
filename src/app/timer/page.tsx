import TimerWithConfig from "@/components/ui/TimerWithConfig";

export default function TimerPage() {
  return (
    <div className="flex flex-col justify-center items-center mx-5 mt-5 gap-3">
      <div className="card w-full max-w-xl bg-neutral text-neutral-content card-xl shadow-sm">
        <div className="card-body items-center">
          <h2 className="card-title text-4xl"><span><span className="italic">Té</span>mporizador</span></h2>
        </div>
      </div>
      <TimerWithConfig />
    </div>
  )
}

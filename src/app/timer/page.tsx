import PageHeader from "@/components/PageHeader";
import TimerWithConfig from "@/components/TimerWithConfig";

export default function TimerPage() {
  return (
    <div className="flex flex-col justify-center items-center mx-5 mt-5 gap-3">
      <PageHeader
        title={
          <>
            <span className="italic">Té</span>mporizador
          </>
        }
      />
      <TimerWithConfig />
    </div>
  );
}

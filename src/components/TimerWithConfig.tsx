"use client";
import { Minus, Plus } from "lucide-react";
import { useId, useState } from "react";

import Timer from "@/components/Timer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

const MIN_SECONDS = 15;
const MAX_SECONDS = 600;

type Step = { add: string; label: string; seconds: number; subtract: string };

const STEPS: Array<Step> = [
  { add: "Sumar un minuto", label: "Minutos", seconds: 60, subtract: "Restar un minuto" },
  { add: "Sumar 15 segundos", label: "Segundos", seconds: 15, subtract: "Restar 15 segundos" },
];

export default function TimerWithConfig() {
  const [seconds, setSeconds] = useState<number>(90);
  const [isPlayingSound, setIsPlayingSound] = useState<boolean>(true);
  // A new duration remounts the timer (key), which would throw away a countdown under way.
  const [isTimerActive, setIsTimerActive] = useState(false);
  const soundSwitchId = useId();

  const changeSeconds = (deltaSeconds: number) => {
    setSeconds((prevState) => Math.max(Math.min(prevState + deltaSeconds, MAX_SECONDS), MIN_SECONDS));
  };

  return (
    <Card className="w-full max-w-xl text-center">
      <CardHeader>
        <CardTitle className="text-xl font-bold">
          <h2>
            Configura tu propio <span className="italic">Té</span>mporizador
          </h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-6">
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
          {STEPS.map((step) => (
            <div aria-label={step.label} className="flex items-center gap-2" key={step.label} role="group">
              <Button
                aria-label={step.subtract}
                disabled={isTimerActive || seconds <= MIN_SECONDS}
                focusableWhenDisabled
                onClick={() => changeSeconds(-step.seconds)}
                size="icon"
                variant="outline"
              >
                <Minus />
              </Button>
              <span aria-hidden="true" className="min-w-20 font-semibold">
                {step.label}
              </span>
              <Button
                aria-label={step.add}
                disabled={isTimerActive || seconds >= MAX_SECONDS}
                focusableWhenDisabled
                onClick={() => changeSeconds(step.seconds)}
                size="icon"
                variant="outline"
              >
                <Plus />
              </Button>
            </div>
          ))}
          <Label className="text-base font-semibold pointer-coarse:min-h-11" htmlFor={soundSwitchId}>
            <Switch checked={isPlayingSound} id={soundSwitchId} onCheckedChange={setIsPlayingSound} />
            Con sonido
          </Label>
        </div>
        <Timer
          isPlayingSound={isPlayingSound}
          key={seconds}
          onActiveChange={setIsTimerActive}
          seconds={seconds}
          size="large"
        />
      </CardContent>
    </Card>
  );
}

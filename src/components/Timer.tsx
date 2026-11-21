"use client";

import { Play, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface TimerProps {
  isPlayingSound?: boolean;
  seconds: number;
}

export default function Timer({ isPlayingSound = true, seconds }: TimerProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(seconds);
  const [isFinished, setIsFinished] = useState(false);
  const endTimeRef = useRef<null | number>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const startTimer = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio("/pourTea.mp3");
    }
    endTimeRef.current = Date.now() + timeLeft * 1000;
    setIsFinished(false);
    setIsRunning(true);
  };

  const resetTimer = () => {
    setIsRunning(false);
    setTimeLeft(seconds);
    endTimeRef.current = null;
  };

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  useEffect(() => {
    if (!isRunning || !endTimeRef.current) return;

    const intervalId = setInterval(() => {
      const now = Date.now();
      const difference = endTimeRef.current! - now;

      if (difference <= 0) {
        setIsFinished(true);
        if (isPlayingSound) {
          audioRef.current?.play();
        }
        setTimeLeft(seconds);
        setIsRunning(false);
        clearInterval(intervalId);
      } else {
        setTimeLeft(Math.ceil(difference / 1000));
      }
    }, 200);

    return () => clearInterval(intervalId);
  }, [isRunning, seconds]);

  return (
    <>
      <div className="flex flex-wrap items-center justify-center gap-4">
        <div
          aria-label="Temporizador"
          className="rounded-xl border border-input bg-popover px-4 py-1.5 text-2xl font-semibold tabular-nums"
          role="timer"
        >
          {formatTime(timeLeft)}
        </div>
        {!isRunning ? (
          <Button className="min-w-32" onClick={startTimer} size="lg">
            <Play data-icon="inline-start" />
            Empezar
          </Button>
        ) : (
          <Button className="min-w-32" onClick={resetTimer} size="lg" variant="outline">
            <RotateCcw data-icon="inline-start" />
            Reiniciar
          </Button>
        )}
      </div>
      <Dialog onOpenChange={setIsFinished} open={isFinished}>
        <DialogContent showCloseButton={false}>
          <DialogHeader className="items-center text-center">
            <DialogTitle className="text-xl font-semibold">
              Es la hora de servir<span className="italic">Té</span>
            </DialogTitle>
          </DialogHeader>
          <DialogFooter className="sm:justify-center">
            <DialogClose render={<Button variant="outline" />}>Cerrar</DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

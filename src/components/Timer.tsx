"use client";

import { cn } from "cn";
import { Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface TimerProps {
  isPlayingSound?: boolean;
  /** Called with true while the countdown runs or is paused, false once it is back at the start. */
  onActiveChange?: (isActive: boolean) => void;
  seconds: number;
  /** `large` when the timer is the page; `compact` inside other content, like a day's brewing notes. */
  size?: "compact" | "large";
}

function toClockLabel(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export default function Timer({ isPlayingSound = true, onActiveChange, seconds, size = "compact" }: TimerProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(seconds);
  const [isFinished, setIsFinished] = useState(false);
  const endTimeRef = useRef<null | number>(null);
  // Milliseconds, so a pause does not round the remaining time up to the next second.
  const remainingMsRef = useRef(seconds * 1000);
  const audioRef = useRef<HTMLAudioElement>(null);
  const mainButtonRef = useRef<HTMLButtonElement>(null);

  const startTimer = () => {
    if (!audioRef.current) {
      const audio = new Audio("/pourTea.mp3");
      // Safari (iOS above all) refuses play() outside a user gesture: playing and stopping it inside this click
      // unlocks the element, so the alarm can sound from the interval later.
      audio.play().catch(() => {});
      audio.pause();
      audio.currentTime = 0;
      audioRef.current = audio;
    }
    endTimeRef.current = Date.now() + remainingMsRef.current;
    setIsFinished(false);
    setIsPaused(false);
    setIsRunning(true);
  };

  const pauseTimer = () => {
    if (endTimeRef.current !== null) {
      remainingMsRef.current = Math.max(endTimeRef.current - Date.now(), 0);
    }
    endTimeRef.current = null;
    setIsRunning(false);
    setIsPaused(true);
  };

  const resetTimer = () => {
    // "Reiniciar" disappears with the reset; the main button stays and becomes "Empezar".
    mainButtonRef.current?.focus();
    endTimeRef.current = null;
    remainingMsRef.current = seconds * 1000;
    setIsRunning(false);
    setIsPaused(false);
    setTimeLeft(seconds);
  };

  useEffect(() => {
    onActiveChange?.(isRunning || isPaused);
  }, [isPaused, isRunning, onActiveChange]);

  useEffect(() => {
    const audio = audioRef;
    return () => audio.current?.pause();
  }, []);

  useEffect(() => {
    if (!isRunning) {
      return;
    }

    const intervalId = setInterval(() => {
      if (endTimeRef.current === null) {
        return;
      }
      const difference = endTimeRef.current - Date.now();

      if (difference <= 0) {
        clearInterval(intervalId);
        endTimeRef.current = null;
        remainingMsRef.current = seconds * 1000;
        setTimeLeft(seconds);
        setIsRunning(false);
        setIsFinished(true);
        if (isPlayingSound) {
          // A refused playback (autoplay rules, no audio output) must not surface as an unhandled rejection.
          audioRef.current?.play().catch(() => {});
        }
      } else {
        setTimeLeft(Math.ceil(difference / 1000));
      }
    }, 200);

    return () => clearInterval(intervalId);
  }, [isPlayingSound, isRunning, seconds]);

  return (
    <>
      <div className={cn("flex flex-col items-center", size === "large" ? "gap-4" : "gap-3")}>
        <div
          aria-label="Temporizador"
          className={cn(
            "leading-none font-semibold tracking-tight tabular-nums",
            size === "large" ? "text-6xl sm:text-7xl" : "text-4xl",
          )}
          role="timer"
        >
          {toClockLabel(timeLeft)}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {isRunning ? (
            <Button className="min-w-32" onClick={pauseTimer} ref={mainButtonRef} size="lg" variant="outline">
              <Pause data-icon="inline-start" />
              Pausar
            </Button>
          ) : isPaused ? (
            <Button className="min-w-32" onClick={startTimer} ref={mainButtonRef} size="lg" variant="outline">
              <Play data-icon="inline-start" />
              Reanudar
            </Button>
          ) : (
            <Button className="min-w-32" disabled={seconds <= 0} onClick={startTimer} ref={mainButtonRef} size="lg">
              <Play data-icon="inline-start" />
              Empezar
            </Button>
          )}
          {(isRunning || isPaused) && (
            <Button onClick={resetTimer} size="lg" variant="ghost">
              <RotateCcw data-icon="inline-start" />
              Reiniciar
            </Button>
          )}
        </div>
      </div>
      <Dialog onOpenChange={setIsFinished} open={isFinished}>
        <DialogContent showCloseButton={false}>
          <DialogHeader className="items-center text-center">
            <DialogTitle className="text-xl font-semibold">
              Es la hora de servir<span className="italic">Té</span>
            </DialogTitle>
            <DialogDescription className="text-base text-foreground">¡El té está listo!</DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center">
            <DialogClose render={<Button variant="outline" />}>Cerrar</DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

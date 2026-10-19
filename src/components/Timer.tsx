"use client";

import { useEffect, useRef, useState } from "react";

interface TimerProps {
  isPlayingSound?: boolean;
  seconds: number;
}

export default function Timer({ isPlayingSound = true, seconds }: TimerProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(seconds);
  const endTimeRef = useRef<null | number>(null);
  const modalRef = useRef<HTMLDialogElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const startTimer = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio("/pourTea.mp3");
    }
    endTimeRef.current = Date.now() + timeLeft * 1000;
    setIsRunning(true);
  };

  const resetTimer = () => {
    setIsRunning(false);
    setTimeLeft(seconds);
    endTimeRef.current = null;
  };

  const openModal = () => {
    modalRef.current?.showModal();
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
        openModal();
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
      <div className="flex gap-6 justify-center items-center">
        <div className="bg-info text-info-content font-bold text-2xl py-2 px-4 rounded-md border-4 border-secondary">
          {formatTime(timeLeft)}
        </div>
        {!isRunning ? (
          <button className="btn btn-primary text-2xl w-25 h-13" disabled={isRunning} onClick={startTimer}>
            Start
          </button>
        ) : (
          <button className="btn btn-warning text-2xl w-25 h-13" disabled={!isRunning} onClick={resetTimer}>
            Reset
          </button>
        )}
      </div>
      <dialog className="modal" ref={modalRef}>
        <div className="modal-box">
          <h3 className="font-bold text-xl place-self-center">
            Es la hora de servir<span className="italic">Té</span>
          </h3>
          <div className="modal-action place-self-center">
            <form method="dialog">
              <button className="btn btn-primary">Close</button>
            </form>
          </div>
        </div>
      </dialog>
    </>
  );
}

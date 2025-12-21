"use client";
import { useState } from "react";
import Timer from "../Timer";

export default function TimerWithConfig() {
  const [seconds, setSeconds] = useState<number>(90);
  const [isPlayingSound, setIsPlayingSound] = useState<boolean>(true);

  const onChangeTimer = (event: React.MouseEvent<HTMLButtonElement>) => {
    let deltaSeconds = parseInt(event.currentTarget.dataset.deltaseconds ?? "0");
    deltaSeconds = Number.isNaN(deltaSeconds) ? 0 : deltaSeconds;
    setSeconds(prevState => Math.max(Math.min(prevState + deltaSeconds, 600), 15));
  }

  const onChangeSound = () => {
    setIsPlayingSound(prevState => !prevState)
  }

  return (
    <div className="bg-base-100 w-full max-w-xl p-5 rounded-2xl justify-center items-center text-center">
      <div className="flex flex-col gap-2 items-center justify-center mb-4">
        <div className="text-xl font-bold">Configura tu propio <span className="italic">Té</span>mporizador</div>
        <div className="flex flex-col md:flex-row flex-wrap gap-2 items-end md:justify-center my-4">
          <div className="flex flex-row flex-wrap gap-2 items-center">
            <div className="font-semibold">Minutos</div>
            <button className="w-15 btn border-3 border-secondary font-extrabold btn-secondary bg-secondary/65" data-deltaseconds="60" onClick={onChangeTimer}>+1</button>
            <button className="w-15 btn border-3 border-secondary font-extrabold btn-warning" data-deltaseconds="-60" onClick={onChangeTimer}>-1</button>
          </div>
          <div className="flex flex-row flex-wrap gap-2 items-center">
            <div className="font-semibold">Segundos</div>
            <button className="w-15 btn border-3 border-secondary font-extrabold btn-secondary bg-secondary/65" data-deltaseconds="15" onClick={onChangeTimer}>+15</button>
            <button className="w-15 btn border-3 border-secondary font-extrabold btn-warning" data-deltaseconds="-15" onClick={onChangeTimer}>-15</button>
          </div>
          <label className="label ml-3 mt-2 font-semibold self-center">
            <input type="checkbox" defaultChecked className="checkbox" onChange={onChangeSound}/>
            Con sonido
          </label>
        </div>
      </div>
      <Timer key={seconds} seconds={seconds} isPlayingSound={isPlayingSound} />
    </div>
  )
}

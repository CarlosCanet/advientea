"use client";

import { addDaysAction } from "@/app/actions/teaInfoActions";
import { useTransition } from "react";

interface ButtonAddDaysProps {
  daysNumber: number;
}

export default function ButtonAddDays({ daysNumber }: ButtonAddDaysProps) {
  const [isPending, startTransition] = useTransition();

  const addDays = async () => {
    console.log("Click!")
    startTransition(async () => {
      await addDaysAction();
    });
  };

  return (
    <>
      {daysNumber < 25 && <button className="btn btn-primary" type="button" onClick={addDays} disabled={isPending}>Crear 25 días</button>}
    </>
  );
}

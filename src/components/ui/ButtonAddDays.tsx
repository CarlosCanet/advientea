"use client";

import { useTransition } from "react";

import { addDaysAction } from "@/app/actions/teaInfoActions";
import { showActionToast } from "@/lib/action-toast";

interface ButtonAddDaysProps {
  daysNumber: number;
  year: number;
}

export default function ButtonAddDays({ daysNumber, year }: ButtonAddDaysProps) {
  const [isPending, startTransition] = useTransition();

  const addDays = () => {
    startTransition(async () => {
      showActionToast(await addDaysAction(year));
    });
  };

  if (daysNumber >= 25) {
    return null;
  }
  return (
    <button className="btn btn-primary" disabled={isPending} onClick={addDays} type="button">
      Crear 25 días
    </button>
  );
}

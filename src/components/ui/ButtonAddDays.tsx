"use client";

import { useTransition } from "react";

import { addDaysAction } from "@/app/actions/teaInfoActions";

import ActionToast, { useActionToast } from "./ActionToast";

interface ButtonAddDaysProps {
  daysNumber: number;
  year: number;
}

export default function ButtonAddDays({ daysNumber, year }: ButtonAddDaysProps) {
  const [isPending, startTransition] = useTransition();
  const { showToast, toast } = useActionToast();

  const addDays = () => {
    startTransition(async () => {
      showToast(await addDaysAction(year));
    });
  };

  return (
    <>
      {daysNumber < 25 && (
        <button className="btn btn-primary" disabled={isPending} onClick={addDays} type="button">
          Crear 25 días
        </button>
      )}
      <ActionToast toast={toast} />
    </>
  );
}

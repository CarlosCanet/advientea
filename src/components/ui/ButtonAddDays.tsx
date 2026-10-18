"use client";

import { addDaysAction } from "@/app/actions/teaInfoActions";
import { useTransition } from "react";
import ActionToast, { useActionToast } from "./ActionToast";

interface ButtonAddDaysProps {
  daysNumber: number;
}

export default function ButtonAddDays({ daysNumber }: ButtonAddDaysProps) {
  const [isPending, startTransition] = useTransition();
  const { toast, showToast } = useActionToast();

  const addDays = () => {
    startTransition(async () => {
      showToast(await addDaysAction());
    });
  };

  return (
    <>
      {daysNumber < 25 && <button className="btn btn-primary" type="button" onClick={addDays} disabled={isPending}>Crear 25 días</button>}
      <ActionToast toast={toast} />
    </>
  );
}

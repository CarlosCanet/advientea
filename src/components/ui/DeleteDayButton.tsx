"use client";

import { useRef, useTransition } from "react";

import { deleteDayAction } from "@/app/actions/editionActions";
import { showActionToast } from "@/lib/action-toast";

import ConfirmDialog from "./ConfirmDialog";

interface DeleteDayButtonProps {
  dayId: string;
  dayNumber: number;
  /** The guesses made on the day: they are deleted with it. */
  guessCount: number;
  isReleased: boolean;
}

function toConfirmMessage(dayNumber: number, guessCount: number): string {
  if (guessCount === 0) {
    return `El día ${dayNumber} ya ha abierto. No tiene apuestas. No se puede deshacer.`;
  }
  if (guessCount === 1) {
    return `El día ${dayNumber} se borrará con su apuesta. No se puede deshacer.`;
  }
  return `El día ${dayNumber} se borrará con sus ${guessCount} apuestas. No se puede deshacer.`;
}

export default function DeleteDayButton({ dayId, dayNumber, guessCount, isReleased }: DeleteDayButtonProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isPending, startTransition] = useTransition();

  // A day nobody has seen or guessed on takes nothing with it, so it goes without asking.
  const needsConfirmation = isReleased || guessCount > 0;

  const deleteDay = () => {
    startTransition(async () => {
      showActionToast(await deleteDayAction(dayId));
    });
  };

  const onClick = () => {
    if (needsConfirmation) {
      dialogRef.current?.showModal();
      return;
    }
    deleteDay();
  };

  return (
    <>
      <button
        aria-label={`Borrar el día ${dayNumber}`}
        className="btn btn-sm btn-error btn-outline"
        disabled={isPending}
        onClick={onClick}
        type="button"
      >
        Borrar
      </button>
      {needsConfirmation && (
        <ConfirmDialog
          confirmClassName="btn-error"
          confirmLabel="Borrar"
          message={toConfirmMessage(dayNumber, guessCount)}
          onConfirm={deleteDay}
          ref={dialogRef}
          title={`¿Borrar el día ${dayNumber}?`}
        />
      )}
    </>
  );
}

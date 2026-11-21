"use client";

import { useState, useTransition } from "react";

import { deleteDayAction } from "@/app/actions/editionActions";
import ConfirmDialog from "@/components/ConfirmDialog";
import { showActionToast } from "@/lib/action-toast";

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
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
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
      setIsConfirmOpen(true);
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
          confirmLabel="Borrar"
          description={toConfirmMessage(dayNumber, guessCount)}
          onConfirm={deleteDay}
          onOpenChange={setIsConfirmOpen}
          open={isConfirmOpen}
          title={`¿Borrar el día ${dayNumber}?`}
          variant="destructive"
        />
      )}
    </>
  );
}

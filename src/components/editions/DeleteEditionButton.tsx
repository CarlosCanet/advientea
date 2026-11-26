"use client";

import { useState, useTransition } from "react";

import { deleteEditionAction } from "@/app/actions/editionActions";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { toActionResponse } from "@/lib/action-response";
import { showActionToast } from "@/lib/action-toast";

interface UseDeleteEditionOptions {
  /** Where focus goes when the confirmation closes; needed when the control that opened it is gone, as a menu item is. */
  finalFocus?: React.RefObject<HTMLElement | null>;
  year: number;
}

/** Deleting an edition, shared by the table's button and the phone card's menu: same action, same confirmation. */
export function useDeleteEdition({ finalFocus, year }: UseDeleteEditionOptions) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const onConfirm = () => {
    startTransition(async () => {
      showActionToast(
        await toActionResponse(deleteEditionAction(year), "No se pudo borrar la edición. Inténtalo de nuevo."),
      );
    });
  };

  const confirmDialog = (
    <ConfirmDialog
      confirmLabel="Borrar"
      description="Solo se puede borrar una edición en preparación que todavía no tenga días ni inscritos. No se puede deshacer."
      finalFocus={finalFocus}
      onConfirm={onConfirm}
      onOpenChange={setIsConfirmOpen}
      open={isConfirmOpen}
      title={`¿Borrar la edición ${year}?`}
      variant="destructive"
    />
  );

  return { confirmDialog, isPending, requestDelete: () => setIsConfirmOpen(true) };
}

export default function DeleteEditionButton({ year }: { year: number }) {
  const { confirmDialog, isPending, requestDelete } = useDeleteEdition({ year });

  return (
    <>
      <Button disabled={isPending} onClick={requestDelete} size="sm" type="button" variant="destructive">
        Borrar
      </Button>
      {confirmDialog}
    </>
  );
}

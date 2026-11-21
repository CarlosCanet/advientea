"use client";

import { useState, useTransition } from "react";

import { deleteEditionAction } from "@/app/actions/editionActions";
import ConfirmDialog from "@/components/ConfirmDialog";
import { showActionToast } from "@/lib/action-toast";

export default function DeleteEditionButton({ year }: { year: number }) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const onConfirm = () => {
    startTransition(async () => {
      showActionToast(await deleteEditionAction(year));
    });
  };

  return (
    <>
      <button
        className="btn btn-sm btn-error btn-outline"
        disabled={isPending}
        onClick={() => setIsConfirmOpen(true)}
        type="button"
      >
        Borrar
      </button>
      <ConfirmDialog
        confirmLabel="Borrar"
        description="Solo se puede borrar una edición en preparación que todavía no tenga días ni inscritos. No se puede deshacer."
        onConfirm={onConfirm}
        onOpenChange={setIsConfirmOpen}
        open={isConfirmOpen}
        title={`¿Borrar la edición ${year}?`}
        variant="destructive"
      />
    </>
  );
}

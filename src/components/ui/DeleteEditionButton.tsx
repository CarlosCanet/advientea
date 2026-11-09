"use client";

import { useRef, useTransition } from "react";

import { deleteEditionAction } from "@/app/actions/editionActions";
import { showActionToast } from "@/lib/action-toast";

import ConfirmDialog from "./ConfirmDialog";

export default function DeleteEditionButton({ year }: { year: number }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
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
        onClick={() => dialogRef.current?.showModal()}
        type="button"
      >
        Borrar
      </button>
      <ConfirmDialog
        confirmClassName="btn-error"
        confirmLabel="Borrar"
        message="Solo se puede borrar una edición en preparación que todavía no tenga días ni inscritos. No se puede deshacer."
        onConfirm={onConfirm}
        ref={dialogRef}
        title={`¿Borrar la edición ${year}?`}
      />
    </>
  );
}

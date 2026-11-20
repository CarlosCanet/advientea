"use client";

import { useRef, useTransition } from "react";

import { unenrolParticipantAction } from "@/app/actions/editionActions";
import { showActionToast } from "@/lib/action-toast";

import ConfirmDialog from "./ConfirmDialog";

interface UnenrolParticipantButtonProps {
  name: string;
  participationId: string;
  /** The tea the participant has uploaded, if any: it is deleted with the participation. */
  teaName: null | string;
}

export default function UnenrolParticipantButton({ name, participationId, teaName }: UnenrolParticipantButtonProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isPending, startTransition] = useTransition();

  const hasTea = teaName !== null;

  const unenrol = () => {
    startTransition(async () => {
      showActionToast(await unenrolParticipantAction(participationId, hasTea));
    });
  };

  // Someone without a tea takes nothing with them, so they go without asking.
  const onClick = () => {
    if (hasTea) {
      dialogRef.current?.showModal();
      return;
    }
    unenrol();
  };

  return (
    <>
      <button
        aria-label={`Quitar a ${name} de la edición`}
        className="btn btn-sm btn-ghost"
        disabled={isPending}
        onClick={onClick}
        type="button"
      >
        Quitar
      </button>
      {hasTea && (
        <ConfirmDialog
          confirmClassName="btn-error"
          confirmLabel="Quitar"
          message={`${name} ya ha subido su té «${teaName}». Se borrará con su historia y sus imágenes, si las tiene. No se puede deshacer.`}
          onConfirm={unenrol}
          ref={dialogRef}
          title={`¿Quitar a ${name} de la edición?`}
        />
      )}
    </>
  );
}

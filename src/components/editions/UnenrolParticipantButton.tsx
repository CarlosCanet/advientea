"use client";

import { useState, useTransition } from "react";

import { unenrolParticipantAction } from "@/app/actions/editionActions";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { showActionToast } from "@/lib/action-toast";

interface UnenrolParticipantButtonProps {
  name: string;
  participationId: string;
  /** The tea the participant has uploaded, if any: it is deleted with the participation. */
  teaName: null | string;
}

export default function UnenrolParticipantButton({ name, participationId, teaName }: UnenrolParticipantButtonProps) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
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
      setIsConfirmOpen(true);
      return;
    }
    unenrol();
  };

  return (
    <>
      <Button
        aria-label={`Quitar a ${name} de la edición`}
        disabled={isPending}
        onClick={onClick}
        size="sm"
        type="button"
        variant="ghost"
      >
        Quitar
      </Button>
      {hasTea && (
        <ConfirmDialog
          confirmLabel="Quitar"
          description={`${name} ya ha subido su té «${teaName}». Se borrará con su historia y sus imágenes, si las tiene. No se puede deshacer.`}
          onConfirm={unenrol}
          onOpenChange={setIsConfirmOpen}
          open={isConfirmOpen}
          title={`¿Quitar a ${name} de la edición?`}
          variant="destructive"
        />
      )}
    </>
  );
}

"use client";

import { useRef, useState, useTransition } from "react";

import { unenrolParticipantAction } from "@/app/actions/editionActions";
import ConfirmDialog from "@/components/ConfirmDialog";
import { planFocusAfterRowRemoval } from "@/components/editions/participant-row-focus";
import { Button } from "@/components/ui/button";
import { toActionResponse } from "@/lib/action-response";
import { showActionToast } from "@/lib/action-toast";

interface UnenrolParticipantButtonProps {
  name: string;
  participationId: string;
  /** The tea the participant has uploaded, if any: it is deleted with the participation. */
  teaName: null | string;
}

interface UseUnenrolParticipantOptions extends UnenrolParticipantButtonProps {
  /** Where focus goes when the confirmation closes; needed when the control that opened it is gone, as a menu item is. */
  finalFocus?: React.RefObject<HTMLElement | null>;
  /** A control inside the participant's row, to find the row whose neighbour takes focus once it is gone. */
  origin: React.RefObject<HTMLElement | null>;
}

/** Removing a participant, shared by the table's button and the phone row's menu: same action, same confirmation. */
export function useUnenrolParticipant({
  finalFocus,
  name,
  origin,
  participationId,
  teaName,
}: UseUnenrolParticipantOptions) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const hasTea = teaName !== null;

  const unenrol = () => {
    const moveFocus = planFocusAfterRowRemoval(origin.current);
    startTransition(async () => {
      const result = await toActionResponse(
        unenrolParticipantAction(participationId, hasTea),
        "No se pudo quitar la inscripción. Inténtalo de nuevo.",
      );
      if (result.success) {
        moveFocus();
      }
      showActionToast(result);
    });
  };

  // Someone without a tea takes nothing with them, so they go without asking.
  const requestUnenrol = () => {
    if (hasTea) {
      setIsConfirmOpen(true);
      return;
    }
    unenrol();
  };

  const confirmDialog = hasTea ? (
    <ConfirmDialog
      confirmLabel="Quitar"
      description={`${name} ya ha subido su té «${teaName}». Se borrará con su historia y sus imágenes, si las tiene. No se puede deshacer.`}
      finalFocus={finalFocus}
      onConfirm={unenrol}
      onOpenChange={setIsConfirmOpen}
      open={isConfirmOpen}
      title={`¿Quitar a ${name} de la edición?`}
      variant="destructive"
    />
  ) : null;

  return { confirmDialog, isPending, requestUnenrol };
}

export default function UnenrolParticipantButton({ name, participationId, teaName }: UnenrolParticipantButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { confirmDialog, isPending, requestUnenrol } = useUnenrolParticipant({
    name,
    origin: buttonRef,
    participationId,
    teaName,
  });

  return (
    <>
      <Button
        aria-label={`Quitar a ${name} de la edición`}
        data-row-action
        disabled={isPending}
        onClick={requestUnenrol}
        ref={buttonRef}
        size="sm"
        type="button"
        variant="ghost"
      >
        Quitar
      </Button>
      {confirmDialog}
    </>
  );
}

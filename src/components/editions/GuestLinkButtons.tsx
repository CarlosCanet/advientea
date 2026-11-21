"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { regenerateGuestLinkAction } from "@/app/actions/editionActions";
import ConfirmDialog from "@/components/ConfirmDialog";
import { showActionToast } from "@/lib/action-toast";

interface GuestLinkButtonsProps {
  name: string;
  participationId: string;
  /** The guest's secret token; null for a guest enrolled before links existed, who has none yet. */
  token: null | string;
}

/** The managers' handle on a guest's secret link: copy it to send it, or replace it when it has leaked. */
export default function GuestLinkButtons({ name, participationId, token }: GuestLinkButtonsProps) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [manualLink, setManualLink] = useState<null | string>(null);

  const copy = async () => {
    if (token === null) {
      return;
    }
    const link = `${window.location.origin}/invitado/${token}`;
    try {
      if (!navigator.clipboard) {
        throw new Error("Clipboard API unavailable");
      }
      await navigator.clipboard.writeText(link);
      setManualLink(null);
      toast.success("Enlace copiado.");
    } catch {
      // Without the clipboard (plain HTTP, a refused permission), the manager copies it by hand.
      setManualLink(link);
    }
  };

  const regenerate = () => {
    startTransition(async () => {
      setManualLink(null);
      showActionToast(await regenerateGuestLinkAction(participationId));
    });
  };

  // A guest without a link loses nothing, so theirs is created without asking.
  const onRegenerateClick = () => {
    if (token === null) {
      regenerate();
      return;
    }
    setIsConfirmOpen(true);
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-1">
        {token !== null && (
          <button aria-label={`Copiar enlace de ${name}`} className="btn btn-xs btn-ghost" onClick={copy} type="button">
            Copiar enlace
          </button>
        )}
        <button
          aria-label={`Nuevo enlace para ${name}`}
          className="btn btn-xs btn-ghost"
          disabled={isPending}
          onClick={onRegenerateClick}
          type="button"
        >
          Nuevo enlace
        </button>
      </div>
      {manualLink !== null && (
        <input
          aria-label={`Enlace de ${name}`}
          className="input input-xs w-full"
          onFocus={(event) => event.currentTarget.select()}
          readOnly
          type="text"
          value={manualLink}
        />
      )}
      {token !== null && (
        <ConfirmDialog
          confirmLabel="Crear enlace nuevo"
          description={`El enlace actual de ${name} dejará de funcionar. ¿Crear uno nuevo?`}
          onConfirm={regenerate}
          onOpenChange={setIsConfirmOpen}
          open={isConfirmOpen}
          title={`Nuevo enlace para ${name}`}
          variant="destructive"
        />
      )}
    </div>
  );
}

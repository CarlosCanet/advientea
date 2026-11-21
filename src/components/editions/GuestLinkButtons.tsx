"use client";

import { Copy, RefreshCw } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { regenerateGuestLinkAction } from "@/app/actions/editionActions";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { showActionToast } from "@/lib/action-toast";

interface GuestLinkButtonsProps {
  name: string;
  participationId: string;
  /** The guest's secret token; null for a guest enrolled before links existed, who has none yet. */
  token: null | string;
}

interface UseGuestLinkOptions extends GuestLinkButtonsProps {
  /** Where focus goes when the confirmation closes; needed when the control that opened it is gone, as a menu item is. */
  finalFocus?: React.RefObject<HTMLElement | null>;
}

/** Copying and replacing a guest's link, shared by the table's buttons and the phone row's menu. */
export function useGuestLink({ finalFocus, name, participationId, token }: UseGuestLinkOptions) {
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
  const requestNewLink = () => {
    if (token === null) {
      regenerate();
      return;
    }
    setIsConfirmOpen(true);
  };

  const confirmDialog =
    token !== null ? (
      <ConfirmDialog
        confirmLabel="Crear enlace nuevo"
        description={`El enlace actual de ${name} dejará de funcionar. ¿Crear uno nuevo?`}
        finalFocus={finalFocus}
        onConfirm={regenerate}
        onOpenChange={setIsConfirmOpen}
        open={isConfirmOpen}
        title={`Nuevo enlace para ${name}`}
        variant="destructive"
      />
    ) : null;

  return { confirmDialog, copy, hasLink: token !== null, isPending, manualLink, requestNewLink };
}

/** The link as text to copy by hand, shown when the clipboard refused it. */
export function ManualGuestLink({ className, link, name }: { className?: string; link: string; name: string }) {
  return (
    <Input
      aria-label={`Enlace de ${name}`}
      className={className ?? "h-8 min-w-64 text-sm md:text-sm"}
      onFocus={(event) => event.currentTarget.select()}
      readOnly
      type="text"
      value={link}
    />
  );
}

/** The managers' handle on a guest's secret link: copy it to send it, or replace it when it has leaked. */
export default function GuestLinkButtons({ name, participationId, token }: GuestLinkButtonsProps) {
  const { confirmDialog, copy, hasLink, isPending, manualLink, requestNewLink } = useGuestLink({
    name,
    participationId,
    token,
  });

  return (
    <div className="mt-1 flex flex-col gap-1">
      <div className="-ml-2.5 flex flex-wrap gap-1">
        {hasLink && (
          <Button aria-label={`Copiar enlace de ${name}`} onClick={copy} size="xs" type="button" variant="ghost">
            <Copy aria-hidden="true" />
            Copiar enlace
          </Button>
        )}
        <Button
          aria-label={`Nuevo enlace para ${name}`}
          disabled={isPending}
          onClick={requestNewLink}
          size="xs"
          type="button"
          variant="ghost"
        >
          <RefreshCw aria-hidden="true" />
          Nuevo enlace
        </Button>
      </div>
      {manualLink !== null && <ManualGuestLink link={manualLink} name={name} />}
      {confirmDialog}
    </div>
  );
}

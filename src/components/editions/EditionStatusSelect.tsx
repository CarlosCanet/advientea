"use client";

import { useRef, useState, useTransition } from "react";

import { changeEditionStatusAction } from "@/app/actions/editionActions";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EditionStatus } from "@/generated/prisma/enums";
import { showActionToast } from "@/lib/action-toast";
import { EDITION_STATUS_LABELS } from "@/lib/utils";

interface EditionStatusSelectProps {
  status: EditionStatus;
  year: number;
}

const STATUS_ORDER = [EditionStatus.PREPARING, EditionStatus.ACTIVE, EditionStatus.ARCHIVED];

const STATUS_ITEMS = STATUS_ORDER.map((option) => ({ label: EDITION_STATUS_LABELS[option], value: option }));

const CONSEQUENCES: Record<EditionStatus, (year: number) => string> = {
  [EditionStatus.ACTIVE]: (year) =>
    `El calendario, las apuestas y el ranking pasarán a ser los de ${year}, que se abre por días desde el 1 de diciembre de ${year}. Solo puede haber una edición activa.`,
  [EditionStatus.ARCHIVED]: (year) =>
    `La edición ${year} quedará cerrada y todo su contenido se revelará, nombres incluidos, a cualquiera con sesión. Lo revelado no se puede volver a ocultar.`,
  [EditionStatus.PREPARING]: (year) =>
    `La edición ${year} dejará de verse: su calendario no mostrará nada hasta que vuelva a activarse.`,
};

export default function EditionStatusSelect({ status, year }: EditionStatusSelectProps) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [target, setTarget] = useState<EditionStatus>(status);
  const [isPending, startTransition] = useTransition();
  // The picked option is gone once the dialog opens, so focus is sent back to the trigger by hand.
  const triggerRef = useRef<HTMLButtonElement>(null);

  // The select always shows the server's status: the change only happens once the dialog is confirmed.
  const onChoose = (chosen: EditionStatus | null) => {
    if (chosen === null || chosen === status) {
      return;
    }
    setTarget(chosen);
    setIsConfirmOpen(true);
  };

  const onConfirm = () => {
    startTransition(async () => {
      showActionToast(await changeEditionStatusAction(year, target));
    });
  };

  return (
    <>
      <Select
        disabled={isPending}
        items={STATUS_ITEMS}
        onValueChange={(chosen, details) => {
          // Only a picked item counts: typing on the closed trigger would otherwise commit a status.
          if (details.reason === "item-press") {
            onChoose(chosen);
          }
        }}
        value={status}
      >
        <SelectTrigger aria-label={`Estado de la edición ${year}`} className="w-40" ref={triggerRef} size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUS_ITEMS.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <ConfirmDialog
        confirmLabel="Cambiar"
        description={CONSEQUENCES[target](year)}
        finalFocus={triggerRef}
        onConfirm={onConfirm}
        onOpenChange={setIsConfirmOpen}
        open={isConfirmOpen}
        title={`¿Pasar la edición ${year} a «${EDITION_STATUS_LABELS[target]}»?`}
        variant={target === EditionStatus.ARCHIVED ? "destructive" : "default"}
      />
    </>
  );
}

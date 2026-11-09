"use client";

import { ChangeEvent, useRef, useState, useTransition } from "react";

import { changeEditionStatusAction } from "@/app/actions/editionActions";
import { EditionStatus } from "@/generated/prisma/enums";
import { EDITION_STATUS_LABELS } from "@/lib/utils";

import ActionToast, { useActionToast } from "./ActionToast";
import ConfirmDialog from "./ConfirmDialog";

interface EditionStatusSelectProps {
  status: EditionStatus;
  year: number;
}

const STATUS_ORDER = [EditionStatus.PREPARING, EditionStatus.ACTIVE, EditionStatus.ARCHIVED];

const CONSEQUENCES: Record<EditionStatus, (year: number) => string> = {
  [EditionStatus.ACTIVE]: (year) =>
    `El calendario, las apuestas y el ranking pasarán a ser los de ${year}, que se abre por días desde el 1 de diciembre de ${year}. Solo puede haber una edición activa.`,
  [EditionStatus.ARCHIVED]: (year) =>
    `La edición ${year} quedará cerrada y todo su contenido se revelará, nombres incluidos, a cualquiera con sesión. Lo revelado no se puede volver a ocultar.`,
  [EditionStatus.PREPARING]: (year) =>
    `La edición ${year} dejará de verse: su calendario no mostrará nada hasta que vuelva a activarse.`,
};

export default function EditionStatusSelect({ status, year }: EditionStatusSelectProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [target, setTarget] = useState<EditionStatus>(status);
  const [isPending, startTransition] = useTransition();
  const { showToast, toast } = useActionToast();

  const onChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setTarget(event.target.value as EditionStatus);
    dialogRef.current?.showModal();
  };

  const onConfirm = () => {
    startTransition(async () => {
      showToast(await changeEditionStatusAction(year, target));
    });
  };

  return (
    <>
      <select
        aria-label={`Estado de la edición ${year}`}
        className="select select-sm w-40"
        disabled={isPending}
        onChange={onChange}
        value={status}
      >
        {STATUS_ORDER.map((option) => (
          <option key={option} value={option}>
            {EDITION_STATUS_LABELS[option]}
          </option>
        ))}
      </select>
      <ConfirmDialog
        confirmClassName={target === EditionStatus.ARCHIVED ? "btn-error" : "btn-primary"}
        confirmLabel="Cambiar"
        message={CONSEQUENCES[target](year)}
        onConfirm={onConfirm}
        ref={dialogRef}
        title={`¿Pasar la edición ${year} a «${EDITION_STATUS_LABELS[target]}»?`}
      />
      <ActionToast toast={toast} />
    </>
  );
}

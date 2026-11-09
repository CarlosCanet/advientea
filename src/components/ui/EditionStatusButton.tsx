"use client";

import { useTransition } from "react";

import { activateEditionAction, archiveEditionAction, deleteEditionAction } from "@/app/actions/editionActions";
import { ActionResponse } from "@/lib/types";

import ActionToast, { useActionToast } from "./ActionToast";

type EditionChange = "activate" | "archive" | "delete";

interface EditionStatusButtonProps {
  change: EditionChange;
  year: number;
}

const CHANGES: Record<
  EditionChange,
  {
    action: (year: number) => Promise<ActionResponse>;
    className?: string;
    confirm: (year: number) => string;
    label: string;
  }
> = {
  activate: {
    action: activateEditionAction,
    confirm: (year: number) => `¿Activar la edición ${year}? El calendario se abrirá el 1 de diciembre de ${year}.`,
    label: "Activar",
  },
  archive: {
    action: archiveEditionAction,
    confirm: (year: number) =>
      `¿Archivar la edición ${year}? Quedará cerrada y todo su contenido se mostrará revelado.`,
    label: "Archivar",
  },
  delete: {
    action: deleteEditionAction,
    className: "btn-error btn-outline",
    confirm: (year: number) => `¿Borrar la edición ${year}? Solo se puede si todavía no tiene días ni inscritos.`,
    label: "Borrar",
  },
};

export default function EditionStatusButton({ change, year }: EditionStatusButtonProps) {
  const [isPending, startTransition] = useTransition();
  const { showToast, toast } = useActionToast();
  const { action, className, confirm, label } = CHANGES[change];

  const onClick = () => {
    if (!window.confirm(confirm(year))) {
      return;
    }
    startTransition(async () => {
      showToast(await action(year));
    });
  };

  return (
    <>
      <button className={`btn btn-sm ${className ?? ""}`} disabled={isPending} onClick={onClick} type="button">
        {label}
      </button>
      <ActionToast toast={toast} />
    </>
  );
}

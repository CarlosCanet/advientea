"use client";

import { useTransition } from "react";

import { activateEditionAction, archiveEditionAction } from "@/app/actions/editionActions";

import ActionToast, { useActionToast } from "./ActionToast";

interface EditionStatusButtonProps {
  change: "activate" | "archive";
  year: number;
}

const CHANGES = {
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
};

export default function EditionStatusButton({ change, year }: EditionStatusButtonProps) {
  const [isPending, startTransition] = useTransition();
  const { showToast, toast } = useActionToast();
  const { action, confirm, label } = CHANGES[change];

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
      <button className="btn btn-sm" disabled={isPending} onClick={onClick} type="button">
        {label}
      </button>
      <ActionToast toast={toast} />
    </>
  );
}

"use client";

import { useActionState, useEffect, useRef } from "react";

import { createEditionAction } from "@/app/actions/editionActions";
import { initialEditionActionResponse } from "@/lib/types";

import ActionToast, { useActionToast } from "./ui/ActionToast";

interface CreateEditionDialogProps {
  suggestedYear: number;
}

export default function CreateEditionDialog({ suggestedYear }: CreateEditionDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, action, isPending] = useActionState(createEditionAction, initialEditionActionResponse);
  const { showToast, toast } = useActionToast();

  useEffect(() => {
    // A failure is shown inside the dialog: a toast would sit behind the modal backdrop.
    if (!state.success) {
      return;
    }
    showToast(state);
    dialogRef.current?.close();
    // showToast is recreated on every render; only a new action result should trigger this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <>
      <button className="btn btn-primary" onClick={() => dialogRef.current?.showModal()} type="button">
        Nueva edición
      </button>
      <dialog className="modal" ref={dialogRef}>
        <div className="modal-box">
          <h2 className="text-lg font-bold mb-4">Nueva edición</h2>
          <form action={action} className="flex flex-col gap-2">
            <label className="floating-label">
              <span>Año</span>
              <input
                className="input w-full"
                defaultValue={state.inputs?.year ?? suggestedYear}
                min={2024}
                name="year"
                required
                type="number"
              />
            </label>
            {state.errors?.properties?.year && (
              <p className="text-sm text-error">{state.errors.properties.year.errors.join(", ")}</p>
            )}
            <label className="floating-label">
              <span>Nombre</span>
              <input
                className="input w-full"
                defaultValue={state.inputs?.name ?? `Advienté ${suggestedYear}`}
                maxLength={60}
                name="name"
                required
                type="text"
              />
            </label>
            {state.errors?.properties?.name && (
              <p className="text-sm text-error">{state.errors.properties.name.errors.join(", ")}</p>
            )}
            <p className="text-sm">La edición se crea en preparación: nada se publica hasta que la actives.</p>
            {!state.success && state.message && !state.errors && (
              <p className="text-sm text-error font-bold" role="alert">
                {state.message}
              </p>
            )}
            <div className="modal-action">
              <button className="btn" onClick={() => dialogRef.current?.close()} type="button">
                Cancelar
              </button>
              <button className="btn btn-primary" disabled={isPending} type="submit">
                Crear
              </button>
            </div>
          </form>
        </div>
        <form className="modal-backdrop" method="dialog">
          <button>Cerrar</button>
        </form>
      </dialog>
      <ActionToast toast={toast} />
    </>
  );
}

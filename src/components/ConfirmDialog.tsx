"use client";

import { Ref } from "react";

interface ConfirmDialogProps {
  confirmClassName?: string;
  confirmLabel: string;
  message: string;
  onConfirm: () => void;
  ref: Ref<HTMLDialogElement>;
  title: string;
}

/** A modal that asks before going ahead; the caller opens it with showModal(). */
export default function ConfirmDialog({
  confirmClassName = "btn-primary",
  confirmLabel,
  message,
  onConfirm,
  ref,
  title,
}: ConfirmDialogProps) {
  return (
    <dialog className="modal" ref={ref}>
      <div className="modal-box">
        <h2 className="text-lg font-bold mb-4">{title}</h2>
        <p>{message}</p>
        <form className="modal-action" method="dialog">
          <button className="btn" type="submit">
            Cancelar
          </button>
          <button className={`btn ${confirmClassName}`} onClick={onConfirm} type="submit">
            {confirmLabel}
          </button>
        </form>
      </div>
      <form className="modal-backdrop" method="dialog">
        <button>Cerrar</button>
      </form>
    </dialog>
  );
}

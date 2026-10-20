"use client";
import { useRef, useTransition } from "react";
import { FaTrashAlt } from "react-icons/fa";

import { deleteDayAction } from "@/app/actions/teaInfoActions";

import ActionToast, { useActionToast } from "./ActionToast";

interface ButtonDeleteDayProps {
  dayId: string;
}

export default function ButtonDeleteDay({ dayId }: ButtonDeleteDayProps) {
  const modalRef = useRef<HTMLDialogElement>(null);
  const [isPending, startTransition] = useTransition();
  const { showToast, toast } = useActionToast();

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteDayAction(dayId);
      modalRef.current?.close();
      showToast(result);
    });
  };

  const openModal = () => {
    modalRef.current?.showModal();
  };

  return (
    <>
      <button className="btn btn-ghost btn-error px-1" disabled={isPending} onClick={openModal}>
        <FaTrashAlt />
      </button>
      <dialog className="modal" ref={modalRef}>
        <div className="modal-box">
          <h3 className="font-bold text-xl">Confirmación de borrado</h3>
          <p className="py-4 text-lg">
            ¿Estás segure de querer borrar día y té? Podrías romper el continuo espacio-
            <span className="italic">Té</span>mpo...
          </p>
          <div className="modal-action">
            <form method="dialog">
              {/* if there is a button in form, it will close the modal */}
              <button className="btn btn-primary">Close</button>
            </form>
            <button className="btn btn-error" disabled={isPending} onClick={handleDelete}>
              Delete
            </button>
          </div>
        </div>
      </dialog>
      <ActionToast toast={toast} />
    </>
  );
}

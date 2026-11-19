"use client";

import { useRef, useState, useTransition } from "react";

import { enrolUserAction } from "@/app/actions/editionActions";
import { showActionToast } from "@/lib/action-toast";
import { UserBasic } from "@/lib/dal";

interface EnrolUserFormProps {
  /** The accounts that are not in the edition yet. */
  users: Array<UserBasic>;
  year: number;
}

export default function EnrolUserForm({ users, year }: EnrolUserFormProps) {
  const [userId, setUserId] = useState("");
  const [isPending, startTransition] = useTransition();
  const selectRef = useRef<HTMLSelectElement>(null);

  if (users.length === 0) {
    return <p className="text-sm">Todas las cuentas están ya en esta edición.</p>;
  }

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isPending) {
      return;
    }
    startTransition(async () => {
      const result = await enrolUserAction(year, userId);
      showActionToast(result);
      if (result.success) {
        setUserId("");
      }
      selectRef.current?.focus();
    });
  };

  return (
    <form className="flex flex-wrap items-end gap-2" onSubmit={onSubmit}>
      <label className="flex flex-col gap-1 text-sm">
        Cuenta
        <select
          // Never disabled while it saves: a disabled field drops the focus; the submit guard covers the wait.
          className="select select-sm w-56"
          onChange={(event) => setUserId(event.target.value)}
          ref={selectRef}
          value={userId}
        >
          <option disabled value="">
            Elige a alguien
          </option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.username}
            </option>
          ))}
        </select>
      </label>
      <button className="btn btn-sm btn-primary" disabled={isPending || userId === ""} type="submit">
        Inscribir
      </button>
    </form>
  );
}

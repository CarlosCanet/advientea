"use client";

import { useRef, useState, useTransition } from "react";

import { enrolGuestAction } from "@/app/actions/editionActions";
import { showActionToast } from "@/lib/action-toast";

export default function EnrolGuestForm({ year }: { year: number }) {
  const [name, setName] = useState("");
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isPending) {
      return;
    }
    startTransition(async () => {
      const result = await enrolGuestAction(year, name);
      showActionToast(result);
      if (result.success) {
        setName("");
      }
      inputRef.current?.focus();
    });
  };

  return (
    <form className="flex flex-wrap items-end gap-2" onSubmit={onSubmit}>
      <label className="flex flex-col gap-1 text-sm">
        Invitado sin cuenta
        <input
          className="input input-sm w-56"
          maxLength={60}
          onChange={(event) => setName(event.target.value)}
          placeholder="Nombre"
          // Read-only, not disabled, while it saves: a disabled field drops the focus and the next guest needs a click.
          readOnly={isPending}
          ref={inputRef}
          type="text"
          value={name}
        />
      </label>
      <button className="btn btn-sm btn-primary" disabled={isPending || name.trim() === ""} type="submit">
        Inscribir
      </button>
    </form>
  );
}

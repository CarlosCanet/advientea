"use client";

import { useId, useRef, useState, useTransition } from "react";

import { enrolGuestAction } from "@/app/actions/editionActions";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { toActionResponse } from "@/lib/action-response";
import { showActionToast } from "@/lib/action-toast";

export default function EnrolGuestForm({ year }: { year: number }) {
  const [name, setName] = useState("");
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isPending) {
      return;
    }
    startTransition(async () => {
      const result = await toActionResponse(
        enrolGuestAction(year, name),
        "No se pudo inscribir al invitado. Inténtalo de nuevo.",
      );
      showActionToast(result);
      if (result.success) {
        setName("");
      }
      inputRef.current?.focus();
    });
  };

  return (
    <form className="flex flex-wrap items-end gap-2" onSubmit={onSubmit}>
      <Field className="w-56 gap-2">
        <FieldLabel htmlFor={inputId}>Invitado sin cuenta</FieldLabel>
        <Input
          id={inputId}
          maxLength={60}
          onChange={(event) => setName(event.target.value)}
          placeholder="Nombre"
          // Read-only, not disabled, while it saves: a disabled field drops the focus and the next guest needs a click.
          readOnly={isPending}
          ref={inputRef}
          type="text"
          value={name}
        />
      </Field>
      <Button disabled={isPending || name.trim() === ""} type="submit">
        Inscribir
      </Button>
    </form>
  );
}

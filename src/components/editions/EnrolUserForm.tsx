"use client";

import { useId, useRef, useState, useTransition } from "react";

import { enrolUserAction } from "@/app/actions/editionActions";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toActionResponse } from "@/lib/action-response";
import { showActionToast } from "@/lib/action-toast";
import { UserBasic } from "@/lib/dal";

interface EnrolUserFormProps {
  /** The accounts that are not in the edition yet. */
  users: Array<UserBasic>;
  year: number;
}

export default function EnrolUserForm({ users, year }: EnrolUserFormProps) {
  const [userId, setUserId] = useState<null | string>(null);
  const [isPending, startTransition] = useTransition();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const triggerId = useId();

  if (users.length === 0) {
    return <p className="text-sm">Todas las cuentas están ya en esta edición.</p>;
  }

  const items = users.map((user) => ({ label: user.username, value: user.id }));

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isPending || userId === null) {
      return;
    }
    startTransition(async () => {
      const result = await toActionResponse(
        enrolUserAction(year, userId),
        "No se pudo inscribir a esa persona. Inténtalo de nuevo.",
      );
      showActionToast(result);
      if (result.success) {
        setUserId(null);
      }
      triggerRef.current?.focus();
    });
  };

  return (
    <form className="flex flex-wrap items-end gap-2" onSubmit={onSubmit}>
      <Field className="w-56 gap-2">
        <FieldLabel htmlFor={triggerId}>Cuenta</FieldLabel>
        {/* Never disabled while it saves: a disabled field drops the focus; the submit guard covers the wait. */}
        <Select items={items} onValueChange={setUserId} value={userId}>
          <SelectTrigger className="w-full" id={triggerId} ref={triggerRef}>
            <SelectValue placeholder="Elige a alguien" />
          </SelectTrigger>
          <SelectContent>
            {items.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Button disabled={isPending || userId === null} type="submit">
        Inscribir
      </Button>
    </form>
  );
}

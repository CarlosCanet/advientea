"use client";

import { useActionState, useId, useState } from "react";

import { createEditionAction } from "@/app/actions/editionActions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { showActionToast } from "@/lib/action-toast";
import { EDITION_YEAR_MAX, EDITION_YEAR_MIN } from "@/lib/schemas/edition";
import { EditionActionResponse, initialEditionActionResponse } from "@/lib/types";

interface CreateEditionDialogProps {
  suggestedYear: number;
}

export default function CreateEditionDialog({ suggestedYear }: CreateEditionDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [state, action, isPending] = useActionState(
    async (previousState: EditionActionResponse, formData: FormData) => {
      const result = await createEditionAction(previousState, formData);
      // A failure stays in the dialog, next to the fields the manager is still filling in.
      if (result.success) {
        showActionToast(result);
        setIsOpen(false);
      }
      return result;
    },
    initialEditionActionResponse,
  );
  const yearId = useId();
  const nameId = useId();

  const yearErrors = state.errors?.properties?.year?.errors;
  const nameErrors = state.errors?.properties?.name?.errors;

  return (
    <Dialog onOpenChange={setIsOpen} open={isOpen}>
      <DialogTrigger render={<Button />}>Nueva edición</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva edición</DialogTitle>
        </DialogHeader>
        <form action={action} className="flex flex-col gap-6">
          <FieldGroup className="gap-4">
            <Field data-invalid={yearErrors ? true : undefined}>
              <FieldLabel htmlFor={yearId}>Año</FieldLabel>
              <Input
                aria-describedby={yearErrors ? `${yearId}-error` : undefined}
                aria-invalid={yearErrors ? true : undefined}
                defaultValue={state.inputs?.year ?? suggestedYear}
                id={yearId}
                max={EDITION_YEAR_MAX}
                min={EDITION_YEAR_MIN}
                name="year"
                required
                type="number"
              />
              {yearErrors && <FieldError id={`${yearId}-error`}>{yearErrors.join(", ")}</FieldError>}
            </Field>
            <Field data-invalid={nameErrors ? true : undefined}>
              <FieldLabel htmlFor={nameId}>Nombre</FieldLabel>
              <Input
                aria-describedby={nameErrors ? `${nameId}-error` : undefined}
                aria-invalid={nameErrors ? true : undefined}
                defaultValue={state.inputs?.name ?? `Advienté ${suggestedYear}`}
                id={nameId}
                maxLength={60}
                name="name"
                required
                type="text"
              />
              {nameErrors && <FieldError id={`${nameId}-error`}>{nameErrors.join(", ")}</FieldError>}
            </Field>
            <FieldDescription>
              La edición se crea en preparación: nada se publica hasta que la actives.
            </FieldDescription>
          </FieldGroup>
          {!state.success && state.message && !state.errors && (
            <p className="text-sm font-semibold text-destructive" role="alert">
              {state.message}
            </p>
          )}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancelar</DialogClose>
            <Button disabled={isPending} type="submit">
              Crear
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { Ellipsis, Trash2 } from "lucide-react";
import { useRef } from "react";

import { useDeleteEdition } from "@/components/editions/DeleteEditionButton";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** The phone card's actions for an edition that can still be deleted. */
export default function EditionActionsMenu({ year }: { year: number }) {
  // Menu items are gone by the time the confirmation closes, so focus goes back to the "⋯" button.
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { confirmDialog, isPending, requestDelete } = useDeleteEdition({ finalFocus: triggerRef, year });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          ref={triggerRef}
          render={<Button aria-label={`Acciones de la edición ${year}`} size="icon-sm" type="button" variant="ghost" />}
        >
          <Ellipsis aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-auto">
          <DropdownMenuItem disabled={isPending} onClick={requestDelete} variant="destructive">
            <Trash2 aria-hidden="true" />
            Borrar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {confirmDialog}
    </>
  );
}

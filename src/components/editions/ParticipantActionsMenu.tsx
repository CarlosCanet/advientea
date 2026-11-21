"use client";

import { Copy, Ellipsis, Eye, Pencil, RefreshCw, UserMinus } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";

import { ManualGuestLink, useGuestLink } from "@/components/editions/GuestLinkButtons";
import { useUnenrolParticipant } from "@/components/editions/UnenrolParticipantButton";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLinkItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ParticipantActionsMenuProps {
  canUnenrol: boolean;
  /** The id of the day row to preview, when the participant holds one. */
  dayId: null | string;
  /** The tea to edit, only when the viewer may edit it. */
  editableTeaId: null | string;
  /** Present for a guest whose link can still be handed out; its token is null when they have none yet. */
  guestLink: null | { token: null | string };
  name: string;
  participationId: string;
  teaName: null | string;
}

/** The phone row's actions, the same ones the table spreads over its columns. */
export default function ParticipantActionsMenu({
  canUnenrol,
  dayId,
  editableTeaId,
  guestLink,
  name,
  participationId,
  teaName,
}: ParticipantActionsMenuProps) {
  // Menu items are gone by the time a confirmation closes, so focus goes back to the "⋯" button.
  const triggerRef = useRef<HTMLButtonElement>(null);
  const unenrol = useUnenrolParticipant({ finalFocus: triggerRef, name, participationId, teaName });
  const link = useGuestLink({ finalFocus: triggerRef, name, participationId, token: guestLink?.token ?? null });

  const hasNavigation = dayId !== null || editableTeaId !== null;
  if (!hasNavigation && guestLink === null && !canUnenrol) {
    return null;
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          ref={triggerRef}
          render={<Button aria-label={`Acciones de ${name}`} size="icon-sm" type="button" variant="ghost" />}
        >
          <Ellipsis aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-auto">
          {hasNavigation && (
            <DropdownMenuGroup>
              {dayId !== null && (
                <DropdownMenuLinkItem closeOnClick render={<Link href={`/teaDay/${dayId}?simulated=true`} />}>
                  <Eye aria-hidden="true" />
                  Ver día
                </DropdownMenuLinkItem>
              )}
              {editableTeaId !== null && (
                <DropdownMenuLinkItem closeOnClick render={<Link href={`/edit-tea-info/${editableTeaId}`} />}>
                  <Pencil aria-hidden="true" />
                  Editar té
                </DropdownMenuLinkItem>
              )}
            </DropdownMenuGroup>
          )}
          {guestLink !== null && (
            <>
              {hasNavigation && <DropdownMenuSeparator />}
              <DropdownMenuGroup>
                {link.hasLink && (
                  <DropdownMenuItem onClick={link.copy}>
                    <Copy aria-hidden="true" />
                    Copiar enlace
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem disabled={link.isPending} onClick={link.requestNewLink}>
                  <RefreshCw aria-hidden="true" />
                  Nuevo enlace
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </>
          )}
          {canUnenrol && (
            <>
              {(hasNavigation || guestLink !== null) && <DropdownMenuSeparator />}
              <DropdownMenuItem disabled={unenrol.isPending} onClick={unenrol.requestUnenrol} variant="destructive">
                <UserMinus aria-hidden="true" />
                Quitar
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {link.manualLink !== null && (
        <ManualGuestLink className="h-9 basis-full text-sm md:text-sm" link={link.manualLink} name={name} />
      )}
      {link.confirmDialog}
      {unenrol.confirmDialog}
    </>
  );
}

"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import { placeParticipantAction, swapParticipantsAction } from "@/app/actions/editionActions";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toActionResponse } from "@/lib/action-response";
import { showActionToast } from "@/lib/action-toast";
import { ActionResponse } from "@/lib/types";

export interface CalendarDayOption {
  dayNumber: number;
  /** Who holds the day, if anyone. */
  holder: null | { name: string; participationId: string };
  /** A day that has opened or has guesses cannot change hands. */
  isLocked: boolean;
}

interface ParticipantDaySelectProps {
  /** The day the participant holds: null for none, and it may be a leftover above the calendar. */
  dayNumber: null | number;
  /** The edition's calendar, days 1..N in order. */
  days: Array<CalendarDayOption>;
  isOwnDayLocked: boolean;
  name: string;
  participationId: string;
}

type SwapTarget = { dayNumber: number; holder: { name: string; participationId: string } };

const NO_DAY_LABEL = "Sin día";
const PLACE_FAILURE = "No se pudo cambiar el día. Inténtalo de nuevo.";

export default function ParticipantDaySelect({
  dayNumber,
  days,
  isOwnDayLocked,
  name,
  participationId,
}: ParticipantDaySelectProps) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [swapTarget, setSwapTarget] = useState<null | SwapTarget>(null);
  const [isPending, startTransition] = useTransition();
  // The picked option is gone once the dialog opens, so focus is sent back to the trigger by hand.
  const triggerRef = useRef<HTMLButtonElement>(null);
  // The day a change started from. The rows re-sort once the new day arrives, and moving this row's node drops
  // its focus; the new day, not the action's answer, marks that commit, since the two can land in either order.
  const refocusFrom = useRef<null | { dayNumber: null | number }>(null);

  useEffect(() => {
    if (isPending || refocusFrom.current === null || refocusFrom.current.dayNumber === dayNumber) {
      return;
    }
    refocusFrom.current = null;
    // The trigger is still disabled when this effect runs, so the focus waits for the next frame.
    requestAnimationFrame(() => {
      const active = document.activeElement;
      if (active === null || active === document.body || active === triggerRef.current) {
        triggerRef.current?.focus();
      }
    });
  }, [dayNumber, isPending]);

  const isOutsideCalendar = dayNumber !== null && !days.some((day) => day.dayNumber === dayNumber);

  const run = (action: () => Promise<ActionResponse>, failureMessage: string) => {
    refocusFrom.current = { dayNumber };
    startTransition(async () => {
      const result = await toActionResponse(action(), failureMessage);
      if (!result.success) {
        refocusFrom.current = null;
      }
      showActionToast(result);
    });
  };

  // The select is never moved here: it shows the day the server says, so a cancelled or refused change leaves no trace.
  const onChoose = (chosen: null | number) => {
    if (chosen === dayNumber) {
      return;
    }
    if (chosen === null) {
      run(() => placeParticipantAction(participationId, null), PLACE_FAILURE);
      return;
    }
    const holder = days.find((day) => day.dayNumber === chosen)?.holder;
    if (holder && holder.participationId !== participationId) {
      setSwapTarget({ dayNumber: chosen, holder });
      setIsConfirmOpen(true);
      return;
    }
    run(() => placeParticipantAction(participationId, chosen), PLACE_FAILURE);
  };

  const onConfirmSwap = () => {
    if (!swapTarget) {
      return;
    }
    const holderParticipationId = swapTarget.holder.participationId;
    run(
      () => swapParticipantsAction(participationId, holderParticipationId),
      "No se pudo intercambiar. Inténtalo de nuevo.",
    );
  };

  const holderName = swapTarget?.holder.name ?? "";
  const holderOutcome = dayNumber === null ? "se quedará sin día" : `al día ${dayNumber}`;

  return (
    <>
      <Select<null | number>
        disabled={isPending || isOwnDayLocked}
        onValueChange={(chosen, details) => {
          // Only a picked item counts: typing on the closed trigger would otherwise commit a day.
          if (details.reason === "item-press") {
            onChoose(chosen);
          }
        }}
        value={dayNumber}
      >
        <SelectTrigger aria-label={`Día de ${name}`} className="w-24 tabular-nums" ref={triggerRef} size="sm">
          <SelectValue>{(value: null | number) => (value === null ? NO_DAY_LABEL : String(value))}</SelectValue>
        </SelectTrigger>
        <SelectContent className="w-auto min-w-(--anchor-width) max-w-[calc(100vw-2rem)]">
          <SelectItem value={null}>{NO_DAY_LABEL}</SelectItem>
          {days.map((day) => (
            <SelectItem className="tabular-nums" disabled={day.isLocked} key={day.dayNumber} value={day.dayNumber}>
              {day.holder && day.holder.participationId !== participationId
                ? `${day.dayNumber} · ${day.holder.name}`
                : day.dayNumber}
            </SelectItem>
          ))}
          {isOutsideCalendar && <SelectItem value={dayNumber}>{`${dayNumber} (fuera del calendario)`}</SelectItem>}
        </SelectContent>
      </Select>
      <ConfirmDialog
        confirmLabel="Intercambiar"
        description={
          swapTarget ? `${name} pasará al día ${swapTarget.dayNumber} y ${holderName} ${holderOutcome}.` : ""
        }
        finalFocus={triggerRef}
        onConfirm={onConfirmSwap}
        onOpenChange={setIsConfirmOpen}
        open={isConfirmOpen}
        title={swapTarget ? `¿Intercambiar con ${holderName}?` : ""}
      />
    </>
  );
}

"use client";

import { ChangeEvent, useRef, useState, useTransition } from "react";

import { placeParticipantAction, swapParticipantsAction } from "@/app/actions/editionActions";
import { showActionToast } from "@/lib/action-toast";
import { ActionResponse } from "@/lib/types";

import ConfirmDialog from "./ConfirmDialog";

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

const NO_DAY = "";

export default function ParticipantDaySelect({
  dayNumber,
  days,
  isOwnDayLocked,
  name,
  participationId,
}: ParticipantDaySelectProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [swapTarget, setSwapTarget] = useState<null | SwapTarget>(null);
  const [isPending, startTransition] = useTransition();

  const isOutsideCalendar = dayNumber !== null && !days.some((day) => day.dayNumber === dayNumber);

  const run = (action: () => Promise<ActionResponse>) => {
    startTransition(async () => {
      showActionToast(await action());
    });
  };

  // The select is never moved here: it shows the day the server says, so a cancelled or refused change leaves no trace.
  const onChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const chosen = event.target.value === NO_DAY ? null : Number(event.target.value);
    if (chosen === dayNumber) {
      return;
    }
    if (chosen === null) {
      run(() => placeParticipantAction(participationId, null));
      return;
    }
    const holder = days.find((day) => day.dayNumber === chosen)?.holder;
    if (holder && holder.participationId !== participationId) {
      setSwapTarget({ dayNumber: chosen, holder });
      dialogRef.current?.showModal();
      return;
    }
    run(() => placeParticipantAction(participationId, chosen));
  };

  const onConfirmSwap = () => {
    if (!swapTarget) {
      return;
    }
    const holderParticipationId = swapTarget.holder.participationId;
    run(() => swapParticipantsAction(participationId, holderParticipationId));
  };

  const holderName = swapTarget?.holder.name ?? "";
  const holderOutcome = dayNumber === null ? "se quedará sin día" : `al día ${dayNumber}`;

  return (
    <>
      <select
        aria-label={`Día de ${name}`}
        className="select select-sm w-22"
        disabled={isPending || isOwnDayLocked}
        onChange={onChange}
        value={dayNumber === null ? NO_DAY : String(dayNumber)}
      >
        <option value={NO_DAY}>Sin día</option>
        {days.map((day) => (
          <option disabled={day.isLocked} key={day.dayNumber} value={day.dayNumber}>
            {day.holder && day.holder.participationId !== participationId
              ? `${day.dayNumber} · ${day.holder.name}`
              : day.dayNumber}
          </option>
        ))}
        {isOutsideCalendar && <option value={dayNumber}>{`${dayNumber} (fuera del calendario)`}</option>}
      </select>
      <ConfirmDialog
        confirmLabel="Intercambiar"
        message={swapTarget ? `${name} pasará al día ${swapTarget.dayNumber} y ${holderName} ${holderOutcome}.` : ""}
        onConfirm={onConfirmSwap}
        ref={dialogRef}
        title={swapTarget ? `¿Intercambiar con ${holderName}?` : ""}
      />
    </>
  );
}

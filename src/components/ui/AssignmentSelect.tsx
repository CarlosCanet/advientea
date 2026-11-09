"use client";
import { useState, useTransition } from "react";

import type { UserBasic } from "@/lib/dal";

import { assignUserToDay } from "@/app/actions/teaInfoActions";
import { showActionToast } from "@/lib/action-toast";

interface AssignmentSelectProps {
  dayId: string;
  guestName?: string;
  userId: string;
  users: Array<UserBasic>;
}

export default function AssignmentSelect({ dayId, guestName, userId, users }: AssignmentSelectProps) {
  const [isPending, startTransition] = useTransition();
  const [currentValue, setCurrentValue] = useState<string>(guestName ?? userId ?? "");

  const handleChangeSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const previousValue = currentValue;
    const nextValue = event.target.value;
    setCurrentValue(nextValue);
    // The guest option is the day's current guest; picking it again is not a new assignment.
    if (nextValue === guestName) {
      return;
    }
    startTransition(async () => {
      const result = await assignUserToDay(dayId, nextValue);
      if (!result.success) {
        setCurrentValue(previousValue);
      }
      showActionToast(result);
    });
  };

  return (
    <select
      className={`select ${!currentValue ? "text-neutral" : ""}`}
      disabled={isPending}
      name={`person-day-${dayId}`}
      onChange={(event) => handleChangeSelect(event)}
      value={currentValue}
    >
      <option value="">Elige a une persone</option>
      {users.map((user) => (
        <option key={user.id} value={user.id}>
          {user.username}
        </option>
      ))}
      {guestName && (
        <option key={`${dayId}-${guestName}`} value={guestName}>
          {guestName}
        </option>
      )}
    </select>
  );
}

"use client";
import { useState, useTransition } from "react";

import { assignUserToDay } from "@/app/actions/teaInfoActions";

import ActionToast, { useActionToast } from "./ActionToast";

interface UserBasic {
  id: string;
  username: string;
}

interface AssignmentSelectProps {
  dayId: string;
  guestName?: string;
  userId: string;
  users: Array<UserBasic>;
}

export default function AssignmentSelect({ dayId, guestName, userId, users }: AssignmentSelectProps) {
  const [isPending, startTransition] = useTransition();
  const [currentValue, setCurrentValue] = useState<string>(guestName ?? userId ?? "");
  const { showToast, toast } = useActionToast();

  const handleChangeSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const previousValue = currentValue;
    const nextValue = event.target.value;
    setCurrentValue(nextValue);
    startTransition(async () => {
      const result = await assignUserToDay(dayId, nextValue, 2025, guestName);
      if (!result.success) {
        setCurrentValue(previousValue);
      }
      showToast(result);
    });
  };

  return (
    <>
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
      <ActionToast toast={toast} />
    </>
  );
}

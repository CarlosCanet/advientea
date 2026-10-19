"use client";
import { assignUserToDay } from "@/app/actions/teaInfoActions";
import { useState, useTransition } from "react";
import ActionToast, { useActionToast } from "./ActionToast";

interface UserBasic {
  id: string;
  username: string
}

interface AssignmentSelectProps {
  userId: string;
  dayId: string;
  users: Array<UserBasic>;
  guestName?: string;
}

export default function AssignmentSelect({ userId, dayId, users, guestName }: AssignmentSelectProps) {
  const [isPending, startTransition] = useTransition();
  const [currentValue, setCurrentValue] = useState<string>(guestName ?? (userId ?? ""));
  const { toast, showToast } = useActionToast();

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
  }

  return (
    <>
      <select value={currentValue} className={`select ${!currentValue ? "text-neutral" : ""}`} name={`person-day-${dayId}`} onChange={(event) => handleChangeSelect(event)} disabled={isPending} >
        <option value="">Elige a une persone</option>
        {users.map((user) => <option key={user.id} value={user.id} >{user.username}</option>)}
        {guestName && <option key={`${dayId}-${guestName}`} value={guestName} >{guestName}</option>}
        </select>
      <ActionToast toast={toast} />
    </>
  )
}

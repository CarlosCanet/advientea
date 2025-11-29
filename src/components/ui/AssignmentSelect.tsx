"use client";
import { assignUserToDay } from "@/app/actions/teaInfoActions";
import { User } from "@/generated/prisma/client";
import { useEffect, useState, useTransition } from "react";

interface AssignmentSelectProps {
  userId: string;
  dayId: string;
  users: Array<User>;
  guestName?: string;
}

export default function AssignmentSelect({ userId, dayId, users, guestName }: AssignmentSelectProps) {
  const [isPending, startTransition] = useTransition();
  const [currentValue, setCurrentValue] = useState<string>(guestName ?? (userId ?? ""));
  const [showToast, setShowToast] = useState<boolean>(false);

  const handleChangeSelect = async (event: React.ChangeEvent<HTMLSelectElement>) => {
    setCurrentValue(event.target.value);
    startTransition(async () => {
      await assignUserToDay(dayId, event.target.value, 2025, guestName);
      setShowToast(true);
    });
  }

  useEffect(() => {
    if (showToast) {
      const timer = setTimeout(() => setShowToast(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [showToast]);
  return (
    <>
      <select value={currentValue} className={`select ${!currentValue ? "text-neutral" : ""}`} name={`person-day-${dayId}`} onChange={(event) => handleChangeSelect(event)} disabled={isPending} >
        <option value="">Elige a une persone</option>
        {users.map((user) => <option key={user.id} value={user.id} >{user.username}</option>)}
        {guestName && <option key={`${dayId}-${guestName}`} value={guestName} >{guestName}</option>}
        </select>
      {showToast &&
        <div className="toast">
          <div className="alert alert-warning">
            <span>Usuario cambiado</span>
          </div>
        </div>
      }
    </>
  )
}
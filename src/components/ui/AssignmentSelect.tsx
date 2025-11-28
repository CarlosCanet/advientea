"use client";
import { assignUserToDay } from "@/app/actions/teaInfoActions";
import { User } from "@/generated/prisma/client";
import { useTransition } from "react";

interface AssignmentSelectProps {
  userId: string;
  dayId: string;
  users: Array<User>;
  guestName?: string;
}

function AssignmentSelect({ userId, dayId, users, guestName }: AssignmentSelectProps) {
  const [isPending, startTransition] = useTransition();

  const handleChangeSelect = async (event: React.ChangeEvent<HTMLSelectElement>) => {
    startTransition(async () => {
      await assignUserToDay(dayId, event.target.value, 2025, guestName);
    });
  }
  return (
    <select defaultValue={guestName ?? (userId ?? "")} className="select" name={`person-day-${dayId}`} onChange={(event) => handleChangeSelect(event)} disabled={isPending} >
      <option value="">Elige a une persone</option>
      {users.map((user) => <option key={user.id} value={user.id} >{user.username}</option>)}
      {guestName && <option key={`${dayId}-${guestName}`} value={guestName} >{guestName}</option>}
    </select>
  )
}
export default AssignmentSelect
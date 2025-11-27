"use client";
import { assignUserToDay } from "@/app/actions/teaInfoActions";
import { User } from "@/generated/prisma/client";
import { useTransition } from "react";

interface AssignmentSelectProps {
  userId: string;
  dayId: string;
  users: Array<User>;
}

function AssignmentSelect({ userId, dayId, users }: AssignmentSelectProps) {
  const [isPending, startTransition] = useTransition();

  const handleChangeSelect = async (event: React.ChangeEvent<HTMLSelectElement>, dayId: string) => {
    startTransition(async () => {
      await assignUserToDay(dayId, event.target.value);
    });
  }
  return (
    <select defaultValue={userId ?? ""} className="select" name={`person-day-${dayId}`} onChange={(event) => handleChangeSelect(event, dayId)} disabled={isPending} >
      <option value="">Elige a une persone</option>
      {users.map((user) => <option key={user.id} value={user.id} >{user.username}</option>)}
    </select>
  )
}
export default AssignmentSelect
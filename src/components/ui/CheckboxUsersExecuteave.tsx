"use client";
import { changeRoleAction } from "@/app/actions/authActions";
import { Role } from "@/generated/prisma/enums"
import { useTransition } from "react"

interface CheckboxUsersExecuteaveProps {
  userId: string,
  role: Role
}
export default function CheckboxUsersExecuteave({ userId, role }: CheckboxUsersExecuteaveProps) {
  const [isPending, startTransition] = useTransition();
  
  const handleChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    await startTransition(async () => {
      const newRole = event.target.checked ? Role.EXECUTEAVE : Role.USER;
      await changeRoleAction(userId, newRole);
    });
  }
  return (
    <>
      {(role !== Role.ADMIN) && <input type="checkbox" checked={role === Role.EXECUTEAVE} onChange={handleChange} disabled={isPending} />}
    </>
  )
}
"use client";
import { changeRoleAction } from "@/app/actions/authActions";
import { Role } from "@/generated/prisma/enums";
import { useState, useTransition } from "react";
import ActionToast, { useActionToast } from "./ActionToast";

interface CheckboxUsersExecuteaveProps {
  userId: string;
  role: Role;
}
export default function CheckboxUsersExecuteave({ userId, role }: CheckboxUsersExecuteaveProps) {
  const [isPending, startTransition] = useTransition();
  const [checked, setChecked] = useState(role === Role.EXECUTEAVE);
  const { toast, showToast } = useActionToast();

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextChecked = event.target.checked;
    setChecked(nextChecked);
    startTransition(async () => {
      const result = await changeRoleAction(userId, nextChecked ? Role.EXECUTEAVE : Role.USER);
      if (!result.success) {
        setChecked(!nextChecked);
      }
      showToast(result);
    });
  };
  return (
    <>
      {role !== Role.ADMIN && <input type="checkbox" checked={checked} onChange={handleChange} disabled={isPending} />}
      <ActionToast toast={toast} />
    </>
  );
}

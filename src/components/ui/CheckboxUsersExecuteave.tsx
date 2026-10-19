"use client";
import { useState, useTransition } from "react";

import { changeRoleAction } from "@/app/actions/authActions";
import { Role } from "@/generated/prisma/enums";

import ActionToast, { useActionToast } from "./ActionToast";

interface CheckboxUsersExecuteaveProps {
  role: Role;
  userId: string;
}
export default function CheckboxUsersExecuteave({ role, userId }: CheckboxUsersExecuteaveProps) {
  const [isPending, startTransition] = useTransition();
  const [checked, setChecked] = useState(role === Role.EXECUTEAVE);
  const { showToast, toast } = useActionToast();

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
      {role !== Role.ADMIN && <input checked={checked} disabled={isPending} onChange={handleChange} type="checkbox" />}
      <ActionToast toast={toast} />
    </>
  );
}

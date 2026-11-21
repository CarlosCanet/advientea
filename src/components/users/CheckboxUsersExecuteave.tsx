"use client";
import { useState, useTransition } from "react";

import { changeRoleAction } from "@/app/actions/authActions";
import { Role } from "@/generated/prisma/enums";
import { showActionToast } from "@/lib/action-toast";

interface CheckboxUsersExecuteaveProps {
  role: Role;
  userId: string;
}
export default function CheckboxUsersExecuteave({ role, userId }: CheckboxUsersExecuteaveProps) {
  const [isPending, startTransition] = useTransition();
  const [checked, setChecked] = useState(role === Role.EXECUTEAVE);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextChecked = event.target.checked;
    setChecked(nextChecked);
    startTransition(async () => {
      const result = await changeRoleAction(userId, nextChecked ? Role.EXECUTEAVE : Role.USER);
      if (!result.success) {
        setChecked(!nextChecked);
      }
      showActionToast(result);
    });
  };
  if (role === Role.ADMIN) {
    return null;
  }
  return <input checked={checked} disabled={isPending} onChange={handleChange} type="checkbox" />;
}

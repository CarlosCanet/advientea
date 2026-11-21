"use client";
import { useState, useTransition } from "react";

import { changeRoleAction } from "@/app/actions/authActions";
import { Switch } from "@/components/ui/switch";
import { Role } from "@/generated/prisma/enums";
import { showActionToast } from "@/lib/action-toast";

interface ManagerRoleSwitchProps {
  role: Role;
  userId: string;
  username: string;
}

export default function ManagerRoleSwitch({ role, userId, username }: ManagerRoleSwitchProps) {
  const [isPending, startTransition] = useTransition();
  const [checked, setChecked] = useState(role === Role.EXECUTEAVE);

  const handleChange = (nextChecked: boolean) => {
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
  return (
    <Switch aria-label={`Gerente: ${username}`} checked={checked} disabled={isPending} onCheckedChange={handleChange} />
  );
}

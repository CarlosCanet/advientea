"use client";
import { useId, useOptimistic, useTransition } from "react";

import { changeRoleAction } from "@/app/actions/authActions";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Role } from "@/generated/prisma/enums";
import { toActionResponse } from "@/lib/action-response";
import { showActionToast } from "@/lib/action-toast";

interface ManagerRoleSwitchProps {
  /** A visible label beside the switch, for layouts without a column header. */
  label?: string;
  role: Role;
  userId: string;
  username: string;
}

export default function ManagerRoleSwitch({ label, role, userId, username }: ManagerRoleSwitchProps) {
  const [isPending, startTransition] = useTransition();
  // Follows the role prop, so every copy of the switch shows what the server says once the action settles.
  const [checked, setOptimisticChecked] = useOptimistic(role === Role.EXECUTEAVE);
  const switchId = useId();

  const handleChange = (nextChecked: boolean) => {
    startTransition(async () => {
      setOptimisticChecked(nextChecked);
      // On any failure the optimistic value falls back to the role prop on its own.
      showActionToast(
        await toActionResponse(
          changeRoleAction(userId, nextChecked ? Role.EXECUTEAVE : Role.USER),
          "No se pudo cambiar el rol. Inténtalo de nuevo.",
        ),
      );
    });
  };
  if (role === Role.ADMIN) {
    return null;
  }
  const control = (
    <Switch
      aria-label={`Gerente: ${username}`}
      checked={checked}
      disabled={isPending}
      id={switchId}
      onCheckedChange={handleChange}
    />
  );
  if (label === undefined) {
    return control;
  }
  return (
    <>
      <Label className="font-normal pointer-coarse:min-h-11" htmlFor={switchId}>
        {label}
      </Label>
      {control}
    </>
  );
}

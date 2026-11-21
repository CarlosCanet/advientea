"use client";

import { LogOutIcon, UserRoundIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import type { NavUser } from "@/components/navigation/navigation";

import { isActivePath, ON_BRAND_GHOST } from "@/components/navigation/navigation";
import ProfileImage from "@/components/profile/ProfileImage";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const PROFILE_HREF = "/profile";

/** The avatar button of the bar from `md` up. Sign-out submits `signoutFormId`, a form outside the popup. */
function ProfileMenu({ signoutFormId, user }: { signoutFormId: string; user: NavUser }) {
  const pathname = usePathname();
  const onProfile = isActivePath(pathname, PROFILE_HREF);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label={`Menú de ${user.username}`}
            className={cn(
              "size-11 rounded-full p-0",
              ON_BRAND_GHOST,
              onProfile && "ring-2 ring-honey ring-offset-2 ring-offset-brand",
            )}
            variant="ghost"
          />
        }
      >
        <ProfileImage className="size-10" image={user.image} name={user.name} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center gap-3 text-popover-foreground">
            <span aria-hidden className="shrink-0">
              <ProfileImage className="size-10" image={user.image} name={user.name} />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium">{user.username}</span>
              {user.subtitle && <span className="truncate text-xs text-muted-foreground">{user.subtitle}</span>}
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            aria-current={onProfile ? "page" : undefined}
            className="aria-[current=page]:font-semibold aria-[current=page]:not-focus:bg-secondary"
            render={<Link href={PROFILE_HREF} />}
          >
            <UserRoundIcon aria-hidden />
            Perfil
          </DropdownMenuItem>
          <DropdownMenuItem nativeButton render={<button className="w-full" form={signoutFormId} type="submit" />}>
            <LogOutIcon aria-hidden />
            Cerrar sesión
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
export default ProfileMenu;

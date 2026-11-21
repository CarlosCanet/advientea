"use client";

import { LogOutIcon, MenuIcon, UserRoundIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import type { NavItem, NavUser } from "@/components/navigation/navigation";

import { isActivePath, MANAGEMENT_ITEMS, ON_BRAND_GHOST, toPrimaryItems } from "@/components/navigation/navigation";
import ProfileImage from "@/components/profile/ProfileImage";
import { Button, buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

// The current page gets a fill and a brand stroke on its left edge; icons carry the brand green.
const SHEET_LINK =
  "relative flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-base font-medium text-popover-foreground outline-none hover:bg-card focus-visible:focus-ring [&_svg]:size-5 [&_svg]:shrink-0 [&_svg]:text-brand before:absolute before:inset-y-2.5 before:left-0 before:w-1 before:rounded-full before:bg-brand before:opacity-0 aria-[current=page]:bg-secondary aria-[current=page]:font-semibold aria-[current=page]:before:opacity-100";

const PROFILE_HREF = "/profile";

/** The menu button of the bar below `md` and the sheet it opens. Sign-out submits `signoutFormId`, a form outside the sheet. */
function MobileNav({
  canManage,
  signoutFormId,
  user,
}: {
  canManage: boolean;
  signoutFormId: string;
  user: NavUser | null;
}) {
  const pathname = usePathname();
  // Open only on the page it was opened on, so any navigation closes it without an effect.
  const [openOn, setOpenOn] = useState<null | string>(null);
  const open = openOn === pathname;
  const close = () => setOpenOn(null);

  const renderLink = (item: NavItem) => (
    <li key={item.href}>
      <Link
        aria-current={isActivePath(pathname, item.href) ? "page" : undefined}
        className={SHEET_LINK}
        href={item.href}
        onClick={close}
      >
        <item.icon aria-hidden />
        {item.label}
      </Link>
    </li>
  );

  return (
    <Sheet onOpenChange={(next) => setOpenOn(next ? pathname : null)} open={open}>
      <SheetTrigger
        render={
          <Button aria-label="Abrir menú" className={cn("md:hidden", ON_BRAND_GHOST)} size="icon-lg" variant="ghost" />
        }
      >
        <MenuIcon aria-hidden className="size-6" />
      </SheetTrigger>
      <SheetContent className="gap-0 data-[side=right]:w-[85%] data-[side=right]:max-w-xs data-[side=right]:sm:max-w-xs">
        <SheetHeader className="min-h-20 justify-center border-b px-4 py-4 pr-16">
          {user ? (
            <div className="flex items-center gap-3">
              <span aria-hidden className="shrink-0">
                <ProfileImage className="size-12" image={user.image} name={user.name} />
              </span>
              <div className="flex min-w-0 flex-col gap-0.5">
                <SheetTitle className="truncate">{user.username}</SheetTitle>
                {user.subtitle && <SheetDescription>{user.subtitle}</SheetDescription>}
              </div>
            </div>
          ) : (
            <SheetTitle className="font-display text-2xl font-normal">
              Advien<i>té</i>
            </SheetTitle>
          )}
        </SheetHeader>

        <nav aria-label="Secciones" className="flex flex-col gap-4 overflow-y-auto p-3">
          <ul className="flex flex-col gap-1">{toPrimaryItems(user !== null).map(renderLink)}</ul>
          {canManage && (
            <div className="flex flex-col gap-1">
              <h2 className="px-3 text-sm font-medium text-muted-foreground" id="sheet-management">
                Gestión
              </h2>
              <ul aria-labelledby="sheet-management" className="flex flex-col gap-1">
                {MANAGEMENT_ITEMS.map(renderLink)}
              </ul>
            </div>
          )}
        </nav>

        <div className="mt-auto flex flex-col gap-1 border-t p-3">
          {user ? (
            <>
              <Link
                aria-current={isActivePath(pathname, PROFILE_HREF) ? "page" : undefined}
                className={SHEET_LINK}
                href={PROFILE_HREF}
                onClick={close}
              >
                <UserRoundIcon aria-hidden />
                Perfil
              </Link>
              <button className={SHEET_LINK} form={signoutFormId} onClick={close} type="submit">
                <LogOutIcon aria-hidden />
                Cerrar sesión
              </button>
            </>
          ) : (
            <div className="flex flex-col gap-2 p-1">
              <Link className={cn(buttonVariants({ size: "lg" }), "w-full")} href="/sign-in" onClick={close}>
                Entrar
              </Link>
              <Link
                className={cn(buttonVariants({ size: "lg", variant: "outline" }), "w-full")}
                href="/sign-up"
                onClick={close}
              >
                Crear cuenta
              </Link>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
export default MobileNav;

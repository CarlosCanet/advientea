"use client";

import { ChevronDownIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  ACTIVE_MARK,
  ACTIVE_MARK_ON,
  isActivePath,
  MANAGEMENT_ITEMS,
  ON_BRAND_GHOST,
  toPrimaryItems,
} from "@/components/navigation/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/** The inline section links of the bar from `md` up, with the "Gestión" menu for managers. */
function DesktopNav({ canManage, signedIn }: { canManage: boolean; signedIn: boolean }) {
  const pathname = usePathname();
  const managing = MANAGEMENT_ITEMS.some((item) => isActivePath(pathname, item.href));

  return (
    <ul className="hidden items-center gap-0.5 md:flex lg:gap-1">
      {toPrimaryItems(signedIn).map((item) => {
        const active = isActivePath(pathname, item.href);
        return (
          <li key={item.href}>
            <Link
              aria-current={active ? "page" : undefined}
              className={cn(
                buttonVariants({ variant: "ghost" }),
                "px-2.5 lg:px-3",
                ON_BRAND_GHOST,
                ACTIVE_MARK,
                active && ACTIVE_MARK_ON,
              )}
              href={item.href}
            >
              {item.label}
            </Link>
          </li>
        );
      })}
      {canManage && (
        <li>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  className={cn("px-2.5 lg:px-3", ON_BRAND_GHOST, ACTIVE_MARK, managing && ACTIVE_MARK_ON)}
                  variant="ghost"
                />
              }
            >
              Gestión
              <ChevronDownIcon aria-hidden data-icon="inline-end" />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="min-w-48">
              <DropdownMenuGroup>
                {MANAGEMENT_ITEMS.map((item) => {
                  const active = isActivePath(pathname, item.href);
                  return (
                    <DropdownMenuItem
                      aria-current={active ? "page" : undefined}
                      className="aria-[current=page]:font-semibold aria-[current=page]:not-focus:bg-secondary"
                      key={item.href}
                      render={<Link href={item.href} />}
                    >
                      <item.icon aria-hidden />
                      {item.label}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </li>
      )}
    </ul>
  );
}
export default DesktopNav;

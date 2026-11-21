import type { LucideIcon } from "lucide-react";

import { CalendarCogIcon, CalendarDaysIcon, LeafIcon, TimerIcon, TrophyIcon, UsersIcon } from "lucide-react";

export type NavItem = { href: string; icon: LucideIcon; label: string };

/** What the navigation shows of the signed-in user; `subtitle` names a manager's role. */
export type NavUser = { image: string; name: string; subtitle: null | string; username: string };

const CALENDAR: NavItem = { href: "/teaDay", icon: CalendarDaysIcon, label: "Calendario" };
const RANKING: NavItem = { href: "/ranking", icon: TrophyIcon, label: "Ranking" };
const MY_TEA: NavItem = { href: "/my-tea", icon: LeafIcon, label: "Mi té" };
const TIMER: NavItem = { href: "/timer", icon: TimerIcon, label: "Temporizador" };

export const MANAGEMENT_ITEMS: Array<NavItem> = [
  { href: "/editions", icon: CalendarCogIcon, label: "Ediciones" },
  { href: "/users", icon: UsersIcon, label: "Usuarios" },
];

export function toPrimaryItems(signedIn: boolean): Array<NavItem> {
  return signedIn ? [CALENDAR, RANKING, MY_TEA, TIMER] : [CALENDAR, TIMER];
}

/** Whether `href` is the current section: the page itself or any page below it (`/teaDay/abc` is Calendario). */
export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

// Ghost's default hover is a light fill with dark text; on the brand bar a white veil keeps the text white.
export const ON_BRAND_GHOST =
  "hover:bg-brand-foreground/10 hover:text-brand-foreground aria-expanded:bg-brand-foreground/15 aria-expanded:text-brand-foreground";

// The current section on the bar: a honey stroke under the label, shown by adding ACTIVE_MARK_ON.
export const ACTIVE_MARK =
  "relative after:pointer-events-none after:absolute after:inset-x-3 after:bottom-1 after:h-0.75 after:rounded-full after:bg-honey after:opacity-0";
export const ACTIVE_MARK_ON = "after:opacity-100";

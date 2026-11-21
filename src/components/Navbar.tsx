import Image from "next/image";
import Link from "next/link";

import type { NavUser } from "@/components/navigation/navigation";

import { signout } from "@/app/actions/authActions";
import DesktopNav from "@/components/navigation/DesktopNav";
import MobileNav from "@/components/navigation/MobileNav";
import { ON_BRAND_GHOST } from "@/components/navigation/navigation";
import ProfileMenu from "@/components/navigation/ProfileMenu";
import { buttonVariants } from "@/components/ui/button";
import { Role } from "@/generated/prisma/enums";
import { getActiveEdition, getSession } from "@/lib/dal";
import { DEFAULT_IMAGE_PROFILE } from "@/lib/types";
import { cn } from "@/lib/utils";

const SIGNOUT_FORM_ID = "signout";

// Only managers get a subtitle: for everyone else the role says nothing they don't know.
const ROLE_SUBTITLES: Partial<Record<Role, string>> = {
  [Role.ADMIN]: "Administración",
  [Role.EXECUTEAVE]: "Gestión del calendario",
};

async function Navbar() {
  const session = await getSession();
  const edition = await getActiveEdition();
  const canManage = session !== null && (session.user.role === Role.ADMIN || session.user.role === Role.EXECUTEAVE);
  const user: NavUser | null = session
    ? {
        image: session.user.image || DEFAULT_IMAGE_PROFILE,
        name: session.user.name,
        subtitle: ROLE_SUBTITLES[session.user.role] ?? null,
        username: session.user.username,
      }
    : null;

  return (
    <header className="fixed inset-x-0 top-0 z-50 h-16 bg-brand text-brand-foreground shadow-sm">
      <nav aria-label="Principal" className="mx-auto flex h-full max-w-6xl items-center gap-2 px-4 md:gap-4 lg:px-6">
        <Link
          className={cn(
            buttonVariants({ variant: "ghost" }),
            "h-12 min-w-0 gap-2 px-2 font-display text-2xl font-normal md:text-xl lg:text-2xl pointer-coarse:h-12",
            ON_BRAND_GHOST,
          )}
          href="/"
        >
          <Image alt="" className="size-10" height={40} src="/LogoAdvientea.png" width={40} />
          <span className="truncate">
            Advien<i>té</i> {edition?.year}
          </span>
        </Link>

        <DesktopNav canManage={canManage} signedIn={user !== null} />

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {user ? (
            <div className="hidden md:block">
              <ProfileMenu signoutFormId={SIGNOUT_FORM_ID} user={user} />
            </div>
          ) : (
            <div className="hidden items-center gap-2 md:flex">
              <Link
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "border-brand-foreground/60 text-brand-foreground",
                  ON_BRAND_GHOST,
                )}
                href="/sign-up"
              >
                Crear cuenta
              </Link>
              <Link
                className={cn(buttonVariants(), "bg-honey text-honey-foreground hover:bg-honey/85")}
                href="/sign-in"
              >
                Entrar
              </Link>
            </div>
          )}
          <MobileNav canManage={canManage} signoutFormId={SIGNOUT_FORM_ID} user={user} />
        </div>

        {/* The form lives outside the popups: a menu or sheet unmounts its content before a nested form could submit. */}
        {user && <form action={signout} className="hidden" id={SIGNOUT_FORM_ID} />}
      </nav>
    </header>
  );
}
export default Navbar;

import type { LucideIcon } from "lucide-react";

import { cn } from "cn";
import { Coffee, Feather, MoonStar } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { HOURS, toHourLabel } from "@/lib/advientea-rules";
import { getActiveEdition, getSession } from "@/lib/dal";

const HEADER_ACTION =
  "h-auto min-h-11 px-8 py-3 text-center text-lg font-semibold whitespace-normal shadow-xl pointer-coarse:h-auto";
const HONEY_ACTION = "bg-honey text-honey-foreground hover:bg-honey/85";
// Outline's own border is grass 12 (2.3:1 on brand) and its hover turns the text dark: white on a darker veil stays 6.3:1.
const ON_BRAND_OUTLINE =
  "border-brand-foreground text-brand-foreground hover:bg-foreground/20 hover:text-brand-foreground";

type Moment = { description: string; hours: Array<number>; icon: LucideIcon; name: string };

const MOMENTS: Array<Moment> = [
  {
    description: "Temperatura y tiempo de infusión, así como si hay o no cafeína presente.",
    hours: [HOURS.PART1],
    icon: Coffee,
    name: "Madrugón",
  },
  {
    description: "Un leve copo de nieve de inspiración.",
    hours: [HOURS.PART2, HOURS.PART3],
    icon: Feather,
    name: "Media mañana",
  },
  {
    description: "Infusión seleccionada y lugar de compra (por si a alguien se le antoja).",
    hours: [HOURS.TEA],
    icon: MoonStar,
    name: "Noche nocturna",
  },
];

export default async function Home() {
  const [session, edition] = await Promise.all([getSession(), getActiveEdition()]);
  const isSignedIn = session !== null;
  const isEditionActive = edition !== null;
  // Without an edition the header already offers signing in, or the participant's tea: the card does not repeat it.
  const showSignInBelow = !isSignedIn && isEditionActive;
  const showMyTeaBelow = isSignedIn && isEditionActive;

  return (
    <div className="mt-16 flex flex-col items-center justify-center gap-6 p-4">
      <header className="relative max-w-md overflow-hidden rounded-2xl bg-brand text-brand-foreground shadow-lg before:content-[''] before:absolute before:inset-0 before:bg-[url('/BackgroundSemiCircleLeaves.svg')] before:-scale-x-100 before:bg-no-repeat before:bg-left before:bg-size-[auto_100%] before:opacity-10 before:[mask-image:linear-gradient(to_right,black_15%,transparent_65%)] before:pointer-events-none">
        <div className="relative flex flex-col gap-2 p-6">
          <h1 className="mb-4 text-center font-display text-4xl font-semibold text-honey">
            Advien<i>té</i>
          </h1>
          <p className="mb-6 text-center font-display text-lg">
            Bienvenides, bienvenidas, bienvenidos, a este lugar de té e infusiones, con la excusa del frío, del fin del
            otoño y de un diciembre acelerado.
          </p>
          <p className="mb-6 text-center font-display text-lg">
            Esta web nos va a servir para compartir las temperaturas y tiempos máximos de las infusiones que hemos
            decidido compartir con el resto del mundo, y también para que compartamos y disfrutemos de aquellos retazos
            de inspiración que nos acunan mientras cogemos la taza caliente con las manos frías.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {isEditionActive ? (
              <Link className={cn(buttonVariants(), HEADER_ACTION, HONEY_ACTION)} href="/teaDay">
                <span>
                  Pasa<span className="italic">Té</span> por
                  <br />
                  el Calendario
                </span>
              </Link>
            ) : isSignedIn ? (
              <Link className={cn(buttonVariants(), HEADER_ACTION, HONEY_ACTION)} href="/my-tea">
                Prepara tu té
              </Link>
            ) : (
              <>
                <Link className={cn(buttonVariants(), HEADER_ACTION, HONEY_ACTION)} href="/sign-in">
                  Entrar
                </Link>
                <Link
                  className={cn(buttonVariants({ variant: "outline" }), HEADER_ACTION, ON_BRAND_OUTLINE)}
                  href="/sign-up"
                >
                  Crear cuenta
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <Card className="w-full max-w-md text-center">
        <CardContent className="flex flex-col gap-6">
          <p className="text-base">
            Día a día se irá publicando la información relevante a las distintas infusiones que hemos seleccionado, con
            este orden:
          </p>
          <ol className="flex flex-col divide-y divide-foreground/10 text-left">
            {MOMENTS.map(({ description, hours, icon: Icon, name }) => (
              <li className="flex items-center gap-4 py-4 first:pt-0 last:pb-0" key={name}>
                <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand text-brand-foreground">
                  <Icon aria-hidden="true" className="size-6" />
                </span>
                <div className="flex flex-col gap-1">
                  <p className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-base font-semibold">{name}</span>
                    <span className="text-sm font-medium tabular-nums">
                      {hours.map((hour, index) => (
                        <span key={hour}>
                          {index > 0 && " y "}
                          <time dateTime={toHourLabel(hour)}>{toHourLabel(hour)}</time>
                        </span>
                      ))}
                    </span>
                  </p>
                  <p className="text-sm">{description}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="text-base">Mi idea es no desvelar quién ha elegido qué infusión hasta el último día.</p>
        </CardContent>
        {(showSignInBelow || showMyTeaBelow) && (
          <CardFooter className="flex-wrap justify-center gap-3">
            {showSignInBelow && (
              <>
                <Link className={buttonVariants()} href="/sign-in">
                  Entrar
                </Link>
                <Link className={buttonVariants({ variant: "outline" })} href="/sign-up">
                  Crear cuenta
                </Link>
              </>
            )}
            {showMyTeaBelow && (
              <Link className={buttonVariants({ variant: "outline" })} href="/my-tea">
                Mi té
              </Link>
            )}
          </CardFooter>
        )}
      </Card>
    </div>
  );
}

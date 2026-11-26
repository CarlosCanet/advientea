import { Hourglass } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { getSession } from "@/lib/dal";

/** Empty state for every page that needs an active edition: says what is going on and when to come back. */
export default async function NoActiveEdition() {
  const session = await getSession();
  return (
    <div className="flex flex-col justify-center items-center mx-5 mt-5 gap-3">
      <Empty className="max-w-xl rounded-2xl bg-card p-6 text-card-foreground shadow-sm sm:p-10">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Hourglass />
          </EmptyMedia>
          <EmptyTitle>
            <h1 className="font-display text-3xl">
              Advien<span className="italic">té</span> está en preparación
            </h1>
          </EmptyTitle>
          <EmptyDescription className="text-base text-foreground">
            <p>Estamos infusionando la próxima edición.</p>
            <p>El calendario vuelve a abrirse el 1 de diciembre.</p>
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent className="flex-row flex-wrap justify-center gap-3">
          {session && (
            <Link className={buttonVariants()} href="/my-tea">
              Mientras tanto, prepara tu té
            </Link>
          )}
          <Link className={buttonVariants({ variant: session ? "outline" : "default" })} href="/">
            Volver al inicio
          </Link>
        </EmptyContent>
      </Empty>
    </div>
  );
}

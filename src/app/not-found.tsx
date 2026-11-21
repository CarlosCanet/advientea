import { Coffee } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

function notFound() {
  return (
    <div className="flex flex-col justify-center items-center mx-5 mt-16 gap-3">
      <Empty className="max-w-xl rounded-2xl bg-card p-6 text-card-foreground shadow-sm sm:p-10">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Coffee />
          </EmptyMedia>
          <EmptyTitle>
            <h1 className="font-display text-3xl">
              Parece que no <span className="italic">Té</span> encuentras
            </h1>
          </EmptyTitle>
          <EmptyDescription className="text-base text-foreground">Error 404</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button nativeButton={false} render={<Link href="/" />}>
            Volver al inicio
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  );
}
export default notFound;

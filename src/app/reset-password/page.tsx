import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

function ResetPasswordPage() {
  return (
    <div className="mx-5 flex justify-center">
      <Card className="my-10 w-full max-w-md shadow-sm sm:my-16">
        <CardHeader>
          <CardTitle>
            <h1 className="font-display text-3xl">Recuperar la contraseña</h1>
          </CardTitle>
        </CardHeader>
        <CardContent className="text-base">
          <p>
            Todavía no se puede recuperar la contraseña desde aquí. Si no consigues entrar, avisa al Geren
            <span className="italic">Té</span> y te ayudará.
          </p>
        </CardContent>
        <CardFooter>
          <Link className={buttonVariants({ className: "w-full", variant: "outline" })} href="/sign-in">
            Volver a entrar
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
export default ResetPasswordPage;

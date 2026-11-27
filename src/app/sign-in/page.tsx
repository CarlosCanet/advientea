import { redirect } from "next/navigation";

import SignInForm from "@/components/SignInForm";
import { getSession } from "@/lib/dal";

interface SignInPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

async function SignInPage({ searchParams }: SignInPageProps) {
  const session = await getSession();
  if (session) {
    redirect("/");
  }
  return (
    <div className="flex justify-center mx-5">
      <SignInForm
        notice={
          (await searchParams)["password-reset"] === "ok"
            ? "Contraseña cambiada. Inicia sesión con la nueva."
            : undefined
        }
      />
    </div>
  );
}
export default SignInPage;

import SignInForm from "@/components/SignInForm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

async function SignInPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) {
    redirect("/");
  }
  return (
    <div className="flex justify-center">
      <SignInForm />
    </div>
  )
}
export default SignInPage
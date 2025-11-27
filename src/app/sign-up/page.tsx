import SignUpForm from "@/components/SignUpForm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function SignUpPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) {
    redirect("/");
  }
  return (
    <>
      <div className="flex justify-center">
        <SignUpForm />
      </div>
    </>
  );
}

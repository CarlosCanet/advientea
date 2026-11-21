import { redirect } from "next/navigation";

import SignUpForm from "@/components/SignUpForm";
import { getSession } from "@/lib/dal";

export default async function SignUpPage() {
  const session = await getSession();
  if (session) {
    redirect("/");
  }
  return (
    <>
      <div className="flex justify-center mx-5">
        <SignUpForm />
      </div>
    </>
  );
}

import { redirect } from "next/navigation";

import SignInForm from "@/components/SignInForm";
import { getSession } from "@/lib/dal";

async function SignInPage() {
  const session = await getSession();
  if (session) {
    redirect("/");
  }
  return (
    <div className="flex justify-center mx-5">
      <SignInForm />
    </div>
  );
}
export default SignInPage;

import ProfileForm from "@/components/ui/ProfileForm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function ProfilePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/");
  }
  const user = session.user;

  return (
    <div className="flex flex-col justify-center items-center mx-5 mt-5 pb-5 gap-3">
      <div className="card w-full max-w-xl bg-neutral text-neutral-content card-md shadow-sm">
        <div className="card-body items-center">
          <div className="card-title text-4xl"><span>Tu Cuen<span className="italic">Té</span></span></div>
        </div>
      </div>
      <div className="card w-full max-w-xl bg-base-100 text-neutral-content card-xl shadow-sm">
        <div className="card-body items-center">
          <ProfileForm username={user.username} email={user.email} imageId={user.image ?? ""} />
        </div>
      </div>
    </div>
  )
}
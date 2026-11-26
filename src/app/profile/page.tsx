import { redirect } from "next/navigation";

import PageHeader from "@/components/PageHeader";
import ProfileForm from "@/components/profile/ProfileForm";
import { Card, CardContent } from "@/components/ui/card";
import { getSession } from "@/lib/dal";
import { DEFAULT_IMAGE_PROFILE } from "@/lib/types";

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) {
    redirect("/");
  }
  const user = session.user;

  return (
    <div className="flex flex-col items-center gap-3 px-4 pt-5 pb-8 sm:px-5">
      <PageHeader
        title={
          <>
            Tu Cuen<span className="italic">Té</span>
          </>
        }
      />
      <Card className="w-full max-w-xl shadow-sm [--card-spacing:--spacing(4)] sm:[--card-spacing:--spacing(8)]">
        <CardContent>
          <ProfileForm email={user.email} imageId={user.image || DEFAULT_IMAGE_PROFILE} username={user.username} />
        </CardContent>
      </Card>
    </div>
  );
}

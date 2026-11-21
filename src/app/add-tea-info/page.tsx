import { headers } from "next/headers";
import { redirect } from "next/navigation";

import AddTeaInfoForm from "@/components/AddTeaInfoForm";
import NoActiveEdition from "@/components/ui/NoActiveEdition";
import { auth } from "@/lib/auth";
import { getActiveEdition } from "@/lib/dal";

/** The public form, for visitors without an account. A signed-in participant saves their tea on /my-tea. */
async function AddTeaInfo() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) {
    redirect("/my-tea");
  }
  const edition = await getActiveEdition();
  if (!edition) {
    return <NoActiveEdition />;
  }

  return (
    <>
      <div className="flex justify-center">
        <AddTeaInfoForm canAssign={false} dayNumber={0} isLoggedIn={false} username="" users={[]} />
      </div>
    </>
  );
}
export default AddTeaInfo;

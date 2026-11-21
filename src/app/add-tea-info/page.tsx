import { redirect } from "next/navigation";

// The public form is gone: guests save their tea through their own link. Old links land on /my-tea, which
// sends anonymous visitors on to sign in.
export default function AddTeaInfo() {
  redirect("/my-tea");
}

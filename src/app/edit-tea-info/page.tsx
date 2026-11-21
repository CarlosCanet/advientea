import { redirect } from "next/navigation";

// A participant's own tea lives on /my-tea now; old links and bookmarks land there.
export default function EditTeaInfo() {
  redirect("/my-tea");
}

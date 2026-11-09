import { toast } from "sonner";

import { ActionResponse } from "@/lib/types";

/** Shows a Server Action's result in the app's Toaster. */
export function showActionToast(result: ActionResponse) {
  if (result.success) {
    toast.success(result.message);
  } else {
    toast.error(result.message);
  }
}

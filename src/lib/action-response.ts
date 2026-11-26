import { ActionResponse } from "@/lib/types";

/**
 * Awaits a Server Action called from the client. One that never answers (offline, server down) rejects, and a
 * rejection inside a transition reaches the error boundary; it becomes a failed response with the action's own
 * wording instead.
 */
export async function toActionResponse(
  pending: Promise<ActionResponse>,
  failureMessage: string,
): Promise<ActionResponse> {
  try {
    return await pending;
  } catch {
    return { message: failureMessage, success: false };
  }
}

import { sendEmail } from "@/lib/email";
import { toResetPasswordEmail } from "@/lib/email-templates/reset-password";

// Runs after the response has been sent, so nobody can handle a failure: it is logged and swallowed. The url carries
// the reset token, so neither it nor the email content nor the address ever reaches the log.
export async function sendResetPasswordEmail({
  url,
  user,
}: {
  url: string;
  user: { email: string; name: string; username?: unknown };
}): Promise<void> {
  try {
    // better-auth types the user without additional fields, but the row it passes has them. `name` is written only
    // at sign-up and goes stale when the username changes.
    const greetingName = typeof user.username === "string" && user.username ? user.username : user.name;
    const email = await toResetPasswordEmail({ url, username: greetingName });
    await sendEmail({ ...email, to: user.email });
  } catch (error) {
    console.error("[sendResetPasswordEmail] failed", error);
  }
}

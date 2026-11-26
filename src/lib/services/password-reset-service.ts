import { sendEmail } from "@/lib/email";
import { toResetPasswordEmail } from "@/lib/email-templates/reset-password";

// Runs after the response has been sent, so nobody can handle a failure: it is logged and swallowed. The url carries
// the reset token, so neither it nor the email content nor the address ever reaches the log.
export async function sendResetPasswordEmail({
  url,
  user,
}: {
  url: string;
  user: { email: string; name: string };
}): Promise<void> {
  try {
    const email = await toResetPasswordEmail({ url, username: user.name });
    await sendEmail({ ...email, to: user.email });
  } catch (error) {
    console.error("[sendResetPasswordEmail] failed", error);
  }
}

import { Resend } from "resend";

const EMAIL_FROM = "GerenTés de AdvienTé <gerente@adviente.carlosca.net>";

export interface EmailMessage {
  html: string;
  subject: string;
  text: string;
  to: string;
}

export async function sendEmail(message: EmailMessage): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not set: the email cannot be sent.");
  }
  // Built per call: the constructor throws without a key, which would break any import where the variable is unset.
  const resend = new Resend(apiKey);
  // The sending domain has no MX, so replies must go to a mailbox elsewhere.
  const replyTo = process.env.EMAIL_REPLY_TO?.trim();
  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    html: message.html,
    subject: message.subject,
    text: message.text,
    to: message.to,
    ...(replyTo ? { replyTo } : {}),
  });
  // Resend reports API failures in the result instead of throwing. The message leaves the email out: it carries the
  // reset token.
  if (error) {
    throw new Error(`Resend could not send the email: ${error.name}: ${error.message}`);
  }
}

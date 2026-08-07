import "server-only";
import { Resend } from "resend";
import type { EmailMessage } from "./messages";

let client: Resend | undefined;

function getResend(): Resend {
  if (client) return client;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("Resend isn't configured - set RESEND_API_KEY (from resend.com > API Keys).");
  }
  client = new Resend(apiKey);
  return client;
}

/**
 * Sends one of the templates in ./messages. `RESEND_FROM_EMAIL` needs a
 * domain verified in Resend to deliver to arbitrary recipients - until
 * that's set up, Resend's shared sandbox sender only delivers to the email
 * on the Resend account itself, which is fine for testing this end to end.
 *
 * `RESEND_REPLY_TO`, if set, routes any reply back to a real inbox instead
 * of bouncing - the from address is a noreply@ sender by design and can't
 * receive mail itself.
 */
export async function sendEmail(to: string, message: EmailMessage) {
  const resend = getResend();
  const from = process.env.RESEND_FROM_EMAIL || "FounderOS <noreply@work.saadmaz.com>";
  const replyTo = process.env.RESEND_REPLY_TO || undefined;
  const { error } = await resend.emails.send({
    from,
    to,
    ...(replyTo ? { replyTo } : {}),
    subject: message.subject,
    html: message.html,
    text: message.text,
  });
  if (error) {
    throw new Error(`Failed to send email via Resend: ${error.message}`);
  }
}

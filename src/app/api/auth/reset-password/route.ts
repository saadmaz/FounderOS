import { NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase/admin";
import { getAppUrl } from "@/lib/email/app-url";
import { passwordResetEmail } from "@/lib/email/messages";
import { sendEmail } from "@/lib/email/send";

// firebase-admin needs Node's crypto/fs/net at import time, none of which
// exist on the Edge runtime - force Node.js explicitly rather than trust
// the default, since a misdetected Edge deploy fails before this file's own
// try/catch ever runs (that's what a bare "500: This page couldn't load"
// with no JSON body means, vs. the {"error": "..."} this route returns).
export const runtime = "nodejs";

/**
 * Generates a password-reset action link via Firebase Admin and emails it
 * ourselves through Resend with our own branded template, instead of
 * letting the client SDK trigger Firebase Auth's built-in (plain-link,
 * unstyled) email.
 *
 * Always responds 200 regardless of whether the email is on file - same
 * "if an account exists..." non-enumerating behavior the login page already
 * promises, just enforced server-side now instead of trusted to the client.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  try {
    const link = await getAdminAuth().generatePasswordResetLink(email, {
      url: `${getAppUrl()}/auth/action`,
    });
    await sendEmail(email, passwordResetEmail(link));
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code !== "auth/user-not-found") {
      console.error("Failed to send password reset email:", err);
      return NextResponse.json({ error: "Couldn't send the reset email" }, { status: 500 });
    }
    // Unknown email - report success anyway so we don't leak account existence.
  }

  return NextResponse.json({ ok: true });
}

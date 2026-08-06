import { NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase/admin";
import { getAppUrl } from "@/lib/email/app-url";
import { verifyEmailEmail } from "@/lib/email/messages";
import { sendEmail } from "@/lib/email/send";

/**
 * Sends the "confirm your email" message via Resend after signup. Requires
 * the caller's own ID token (not just an email in the body) so this can't be
 * used to spam verification emails at arbitrary addresses.
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;
  if (!idToken) {
    return NextResponse.json({ error: "Missing auth token" }, { status: 401 });
  }

  try {
    const decoded = await getAdminAuth().verifyIdToken(idToken);
    if (!decoded.email) {
      return NextResponse.json({ error: "Account has no email address" }, { status: 400 });
    }
    if (decoded.email_verified) {
      return NextResponse.json({ ok: true, alreadyVerified: true });
    }

    const link = await getAdminAuth().generateEmailVerificationLink(decoded.email, {
      url: `${getAppUrl()}/auth/action`,
    });
    await sendEmail(decoded.email, verifyEmailEmail(link));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to send verification email:", err);
    return NextResponse.json({ error: "Couldn't send the verification email" }, { status: 500 });
  }
}

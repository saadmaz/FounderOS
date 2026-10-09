import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebase/admin";
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
 * Per-email cooldown so this public, unauthenticated endpoint can't be used
 * to repeatedly email someone a real reset link - nothing here requires
 * proving you own the address. Kept in Firestore (keyed by a hash of the
 * email, so the collection never holds plaintext addresses) rather than
 * in memory, since serverless instances neither share memory nor survive
 * cold starts. `rateLimits` has no client rules, so only Admin can touch it.
 */
const RESET_COOLDOWN_MS = 60_000;

/** Atomically checks-and-claims the cooldown slot; false = still cooling down. */
async function claimResetSlot(email: string): Promise<boolean> {
  const key = createHash("sha256").update(email).digest("hex");
  const db = getAdminFirestore();
  const ref = db.doc(`rateLimits/password-reset-${key}`);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const last = snap.exists ? (snap.data()?.lastSentAt as number | undefined) : undefined;
    if (last && Date.now() - last < RESET_COOLDOWN_MS) return false;
    tx.set(ref, { lastSentAt: Date.now() });
    return true;
  });
}

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
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  try {
    if (!(await claimResetSlot(email))) {
      // Same non-enumerating 200 as every other outcome here - a cooldown
      // hit shouldn't tell a caller anything about whether the address is real.
      return NextResponse.json({ ok: true });
    }
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

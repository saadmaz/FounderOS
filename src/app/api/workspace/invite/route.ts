import { NextResponse } from "next/server";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebase/admin";
import { getAppUrl } from "@/lib/email/app-url";
import { inviteEmail } from "@/lib/email/messages";
import { sendEmail } from "@/lib/email/send";
import { ROLES } from "@/lib/types";

// firebase-admin needs Node's crypto/fs/net at import time - see
// reset-password/route.ts for the full explanation.
export const runtime = "nodejs";

function roleLabel(role: string): string {
  return ROLES.find((r) => r.value === role)?.label ?? role;
}

/**
 * Sends the invite email for an invite doc that was already created
 * client-side (Firestore rules already gated that create to owner/admin of
 * the target workspace). This route's only job is proving the caller asking
 * to send the email is the same person who created that invite - it doesn't
 * re-check workspace role, since the doc couldn't exist otherwise.
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;
  if (!idToken) {
    return NextResponse.json({ error: "Missing auth token" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const inviteId = typeof body?.inviteId === "string" ? body.inviteId : null;
  if (!inviteId) {
    return NextResponse.json({ error: "inviteId is required" }, { status: 400 });
  }

  try {
    const decoded = await getAdminAuth().verifyIdToken(idToken);
    const db = getAdminFirestore();
    const snap = await db.doc(`invites/${inviteId}`).get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    }
    const invite = snap.data() as {
      workspaceName: string;
      email: string;
      role: string;
      invitedBy: string;
      invitedByName: string;
      status: string;
    };
    if (invite.invitedBy !== decoded.uid) {
      return NextResponse.json({ error: "Not authorized to send this invite" }, { status: 403 });
    }
    if (invite.status !== "pending") {
      return NextResponse.json({ error: "Invite is no longer pending" }, { status: 400 });
    }

    const link = `${getAppUrl()}/invite/${inviteId}`;
    await sendEmail(
      invite.email,
      inviteEmail(invite.workspaceName, invite.invitedByName, roleLabel(invite.role), link)
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to send invite email:", err);
    return NextResponse.json({ error: "Couldn't send the invite email" }, { status: 500 });
  }
}

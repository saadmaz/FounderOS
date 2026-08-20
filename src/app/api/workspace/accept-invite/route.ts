import { NextResponse } from "next/server";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebase/admin";

// firebase-admin needs Node's crypto/fs/net at import time - see
// reset-password/route.ts for the full explanation.
export const runtime = "nodejs";

/**
 * Writes the member doc that accepting an invite requires. This has to run
 * server-side with Admin privileges (not a client Firestore write) because
 * Firestore rules can only authorize a write by looking up an exact document
 * path, and there's no path the `members` rule could look up to confirm "a
 * pending invite exists for this caller's email" - the invite's id has to
 * stay unguessable/non-enumerable (see firestore.rules), so the rule has no
 * way to find it on its own. This route is handed the id directly (from the
 * link the user clicked) and does the cross-document check here instead.
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
    if (!decoded.email) {
      return NextResponse.json({ error: "Account has no email address" }, { status: 400 });
    }

    const db = getAdminFirestore();
    const inviteRef = db.doc(`invites/${inviteId}`);
    const snap = await inviteRef.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    }
    const invite = snap.data() as {
      workspaceId: string;
      email: string;
      role: string;
      status: string;
      expiresAt: number;
    };

    if (invite.status !== "pending") {
      return NextResponse.json({ error: "This invite has already been used or revoked" }, { status: 400 });
    }
    if (Date.now() > invite.expiresAt) {
      return NextResponse.json({ error: "This invite has expired" }, { status: 400 });
    }
    if (invite.email !== decoded.email.toLowerCase()) {
      return NextResponse.json(
        { error: `This invite is for ${invite.email}, not ${decoded.email}` },
        { status: 403 }
      );
    }

    const ts = Date.now();
    const memberRef = db.doc(`workspaces/${invite.workspaceId}/members/${decoded.uid}`);
    const pointerRef = db.doc(`userWorkspaces/${decoded.uid}`);

    const batch = db.batch();
    batch.set(memberRef, {
      workspaceId: invite.workspaceId,
      email: decoded.email,
      displayName: decoded.name ?? decoded.email,
      ...(decoded.picture ? { photoURL: decoded.picture } : {}),
      role: invite.role,
      createdAt: ts,
    });
    batch.update(inviteRef, {
      status: "accepted",
      acceptedAt: ts,
      acceptedBy: decoded.uid,
    });
    // Intentionally overwrites any prior workspace pointer - this app is
    // one-workspace-per-user, and the client warns before calling this route
    // if the user already belongs to a different workspace.
    batch.set(pointerRef, { primaryWorkspaceId: invite.workspaceId });
    await batch.commit();

    return NextResponse.json({ ok: true, workspaceId: invite.workspaceId });
  } catch (err) {
    console.error("Failed to accept invite:", err);
    return NextResponse.json({ error: "Couldn't accept the invite" }, { status: 500 });
  }
}

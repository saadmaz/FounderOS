import { NextResponse } from "next/server";
import { INVITABLE_ROLES, verifyRequestUser } from "@/lib/auth/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import type { Role } from "@/lib/types";

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
  const decoded = await verifyRequestUser(request);
  if (!decoded) {
    return NextResponse.json({ error: "Missing or invalid auth token" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const inviteId = typeof body?.inviteId === "string" ? body.inviteId : null;
  if (!inviteId) {
    return NextResponse.json({ error: "inviteId is required" }, { status: 400 });
  }
  if (!decoded.email) {
    return NextResponse.json({ error: "Account has no email address" }, { status: 400 });
  }
  const email = decoded.email.toLowerCase();

  try {
    const db = getAdminFirestore();
    const inviteRef = db.doc(`invites/${inviteId}`);

    // A transaction (not read-then-batch) so two concurrent accepts of the
    // same invite can't both see it as pending and both write a member doc.
    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(inviteRef);
      if (!snap.exists) return { status: 404, error: "Invite not found" } as const;
      const invite = snap.data() as {
        workspaceId: string;
        email: string;
        role: Role;
        status: string;
        expiresAt: number;
      };

      if (invite.status !== "pending") {
        return { status: 400, error: "This invite has already been used or revoked" } as const;
      }
      if (Date.now() > invite.expiresAt) {
        return { status: 400, error: "This invite has expired" } as const;
      }
      if (invite.email !== email) {
        return { status: 403, error: `This invite is for ${invite.email}, not ${decoded.email}` } as const;
      }
      // Defense in depth on top of firestore.rules: never let an invite
      // grant "owner" (or any unknown role string), however the doc got here.
      if (!INVITABLE_ROLES.includes(invite.role)) {
        return { status: 400, error: "This invite has an invalid role" } as const;
      }

      const ts = Date.now();
      const memberRef = db.doc(`workspaces/${invite.workspaceId}/members/${decoded.uid}`);
      const memberSnap = await tx.get(memberRef);
      // Re-accepting into a workspace you already belong to must not
      // overwrite your existing role (e.g. demote/promote an existing owner).
      if (!memberSnap.exists) {
        tx.set(memberRef, {
          workspaceId: invite.workspaceId,
          email: decoded.email,
          displayName: decoded.name ?? decoded.email,
          ...(decoded.picture ? { photoURL: decoded.picture } : {}),
          role: invite.role,
          createdAt: ts,
        });
      }
      tx.update(inviteRef, { status: "accepted", acceptedAt: ts, acceptedBy: decoded.uid });
      // Intentionally overwrites any prior workspace pointer - this app is
      // one-workspace-per-user, and the client warns before calling this
      // route if the user already belongs to a different workspace.
      tx.set(db.doc(`userWorkspaces/${decoded.uid}`), { primaryWorkspaceId: invite.workspaceId });
      return { status: 200, workspaceId: invite.workspaceId } as const;
    });

    if (result.status !== 200) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ ok: true, workspaceId: result.workspaceId });
  } catch (err) {
    console.error("Failed to accept invite:", err);
    return NextResponse.json({ error: "Couldn't accept the invite" }, { status: 500 });
  }
}

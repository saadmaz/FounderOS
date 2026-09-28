import { NextResponse } from "next/server";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebase/admin";
import { isGoogleCalendarConfigured } from "@/lib/google-calendar/client";
import { buildConsentUrl } from "@/lib/google-calendar/oauth";

// firebase-admin needs Node's crypto/fs/net at import time - see
// reset-password/route.ts for the full explanation.
export const runtime = "nodejs";

/**
 * Starts the Google Calendar OAuth flow: mints a short-lived, single-use
 * `oauthStates` doc carrying the caller's identity (a browser redirect to
 * Google and back can't carry our own Authorization header, so this is how
 * the callback route in this same directory knows who's connecting), then
 * returns the consent URL for the client to navigate to.
 */
export async function POST(request: Request) {
  if (!isGoogleCalendarConfigured()) {
    return NextResponse.json(
      { error: "Google Calendar isn't configured on this deployment yet." },
      { status: 503 }
    );
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;
  if (!idToken) {
    return NextResponse.json({ error: "Missing auth token" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const workspaceId = typeof body?.workspaceId === "string" ? body.workspaceId : null;
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
  }

  try {
    const decoded = await getAdminAuth().verifyIdToken(idToken);
    const db = getAdminFirestore();
    const memberSnap = await db.doc(`workspaces/${workspaceId}/members/${decoded.uid}`).get();
    if (!memberSnap.exists) {
      return NextResponse.json({ error: "Not a member of this workspace" }, { status: 403 });
    }

    const stateRef = db.collection("oauthStates").doc();
    await stateRef.set({ uid: decoded.uid, workspaceId, createdAt: Date.now() });

    return NextResponse.json({ url: buildConsentUrl(stateRef.id) });
  } catch (err) {
    console.error("Failed to start Google Calendar connect flow:", err);
    return NextResponse.json({ error: "Couldn't start the connect flow" }, { status: 500 });
  }
}

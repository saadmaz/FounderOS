import { NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase/admin";
import { getConnection } from "@/lib/google-calendar/client";
import { pullChangesForConnection, pushAllExistingItems } from "@/lib/google-calendar/sync";

export const runtime = "nodejs";
// See the reconcile cron route for why this stays within the Hobby plan's
// ceiling - pushAllExistingItems below can take a while on a workspace with
// a lot of history.
export const maxDuration = 60;

/** Manual "Sync now" button target - runs a full two-way resync for the
 * caller immediately instead of waiting on the webhook/daily cron: pulls in
 * whatever changed on the Google side, and (re-)pushes every existing
 * FounderOS item they should see (idempotent - see pushAllExistingItems).
 * The latter is also what makes this the fix for "I connected and nothing
 * showed up in Google" without needing to disconnect/reconnect. */
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;
  if (!idToken) {
    return NextResponse.json({ error: "Missing auth token" }, { status: 401 });
  }

  try {
    const decoded = await getAdminAuth().verifyIdToken(idToken);
    const connection = await getConnection(decoded.uid);
    if (!connection) {
      return NextResponse.json({ error: "Google Calendar isn't connected" }, { status: 400 });
    }

    await pullChangesForConnection(decoded.uid);
    await pushAllExistingItems(decoded.uid, connection.workspaceId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Manual Google Calendar sync failed:", err);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}

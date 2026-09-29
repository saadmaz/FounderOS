import { after, NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase/admin";
import { getConnection } from "@/lib/google-calendar/client";
import { runFullSync } from "@/lib/google-calendar/full-sync";

export const runtime = "nodejs";
// See the reconcile cron route for why this stays within the Hobby plan's
// ceiling.
export const maxDuration = 60;

/**
 * Manual "Sync now" button target - kicks off a full two-way resync for the
 * caller (see runFullSync) and returns immediately. Not awaited: a real
 * Google account's calendar/task history is slow and variable enough that
 * awaiting it here was hitting a 504 on the browser's own fetch before the
 * work even finished. The connection's status/lastSyncedAt fields (which
 * the UI polls via GET .../status) update once the background run
 * completes, so the card catches up within a few seconds on its own.
 */
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

    after(() => runFullSync(decoded.uid, connection.workspaceId));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Manual Google Calendar sync failed:", err);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}

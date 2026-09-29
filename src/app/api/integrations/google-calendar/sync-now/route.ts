import { after, NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase/admin";
import { getConnection } from "@/lib/google-calendar/client";
import { pullChangesForConnection, pushAllExistingItems } from "@/lib/google-calendar/sync";
import { pullTasksForConnection, pushAllExistingTasks } from "@/lib/google-calendar/task-sync";

export const runtime = "nodejs";
// See the reconcile cron route for why this stays within the Hobby plan's
// ceiling. pushAllExistingItems runs via after() below (not awaited before
// responding) specifically so a slow backfill can't turn into a 504 on the
// browser's fetch - but the function invocation itself is still subject to
// this same cap while that background work finishes.
export const maxDuration = 60;

/**
 * Manual "Sync now" button target - kicks off a full two-way resync for the
 * caller (pull + backfill push, for both calendar events and tasks) and
 * returns immediately. Every step runs via after(), not awaited: this used
 * to await the two pulls before responding on the theory that it kept the
 * UI's refreshed status accurate, but a real Google account's primary
 * calendar/task history is slow and variable enough that this was hitting
 * a 504 on the browser's own fetch before the pulls even finished - the
 * same problem pushAllExistingItems/pushAllExistingTasks already solved by
 * going through after() instead of being awaited. The connection's
 * status/lastSyncedAt fields (which the UI polls via GET .../status) update
 * as each background step completes, so the card catches up within a few
 * seconds without the request itself needing to wait on any of it.
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

    after(() => pullChangesForConnection(decoded.uid));
    after(() => pullTasksForConnection(decoded.uid, connection.workspaceId));
    after(() => pushAllExistingItems(decoded.uid, connection.workspaceId));
    after(() => pushAllExistingTasks(decoded.uid, connection.workspaceId));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Manual Google Calendar sync failed:", err);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}

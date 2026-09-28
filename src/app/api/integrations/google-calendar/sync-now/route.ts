import { after, NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase/admin";
import { getConnection } from "@/lib/google-calendar/client";
import { pullChangesForConnection, pushAllExistingItems } from "@/lib/google-calendar/sync";
import { pushAllExistingTasks } from "@/lib/google-calendar/task-sync";

export const runtime = "nodejs";
// See the reconcile cron route for why this stays within the Hobby plan's
// ceiling. pushAllExistingItems runs via after() below (not awaited before
// responding) specifically so a slow backfill can't turn into a 504 on the
// browser's fetch - but the function invocation itself is still subject to
// this same cap while that background work finishes.
export const maxDuration = 60;

/** Manual "Sync now" button target - runs a full two-way resync for the
 * caller: pulls in whatever changed on the Google side (awaited, so the
 * status the UI refreshes right after is accurate), and (re-)pushes every
 * existing FounderOS item they should see in the background via after()
 * (idempotent - see pushAllExistingItems). That backfill is also what
 * fixes "I connected and nothing showed up in Google" without needing to
 * disconnect/reconnect - it just won't be instantly done by the time this
 * request returns on a workspace with a lot of history. */
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
    after(() => pushAllExistingItems(decoded.uid, connection.workspaceId));
    after(() => pushAllExistingTasks(decoded.uid, connection.workspaceId));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Manual Google Calendar sync failed:", err);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}

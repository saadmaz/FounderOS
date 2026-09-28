import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { pullChangesForConnection } from "@/lib/google-calendar/sync";

export const runtime = "nodejs";
// Sequential per connection, and no fixed cap on the run - fine at this
// app's scale (a handful of connected members), and simpler than juggling
// concurrency limits against Google's per-user rate limits. If this ever
// needs to scale up, batch connections and run them with limited
// concurrency instead of all at once.
export const maxDuration = 300;

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
}

/**
 * The resilience backstop for the whole sync system: runs the same
 * incremental pull the webhook triggers, but on a timer for every
 * connection, regardless of whether Google's push notification arrived.
 * This - not the webhook - is what actually guarantees Google-side changes
 * eventually reach FounderOS.
 */
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const snap = await getAdminFirestore().collection("googleCalendarConnections").get();
  for (const doc of snap.docs) {
    await pullChangesForConnection(doc.id);
  }

  return NextResponse.json({ ok: true, checked: snap.size });
}

import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { pullChangesForConnection } from "@/lib/google-calendar/sync";

export const runtime = "nodejs";
// Sequential per connection - fine at this app's scale (a handful of
// connected members), and simpler than juggling concurrency limits against
// Google's per-user rate limits. If this ever needs to scale up, batch
// connections and run them with limited concurrency instead of all at once.
// 60s (not higher) deliberately - Vercel rejects a deploy outright if
// maxDuration exceeds what the account's plan allows, the same way it just
// did for an out-of-range cron schedule (see vercel.json) - Hobby's ceiling
// is the one all plans can build under.
export const maxDuration = 60;

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

import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { runFullSync } from "@/lib/google-calendar/full-sync";
import type { GoogleCalendarConnection } from "@/lib/types";

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
 * The resilience backstop for the whole sync system: runs a full sync (see
 * runFullSync) for every connection on a timer, regardless of whether
 * Google's push notification arrived or a client-side push ever fired.
 * This - not the webhook, not notifyGoogleSync - is what actually
 * guarantees changes on either side eventually reach the other, and the
 * *only* way Google Tasks changes ever reach FounderOS at all (there's no
 * webhook equivalent for Tasks - see task-sync.ts's module docstring).
 * runFullSync's own lock means this naturally skips a connection that's
 * already mid-sync from a manual "Sync now" click, rather than piling on.
 */
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const snap = await getAdminFirestore().collection("googleCalendarConnections").get();
  for (const doc of snap.docs) {
    await runFullSync(doc.id, (doc.data() as GoogleCalendarConnection).workspaceId);
  }

  return NextResponse.json({ ok: true, checked: snap.size });
}

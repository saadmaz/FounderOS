import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { pullChangesForConnection } from "@/lib/google-calendar/sync";

export const runtime = "nodejs";

/**
 * Google's push-notification target for a connection's watch() channel
 * (src/lib/google-calendar/watch.ts). The request carries no body, only
 * headers - `X-Goog-Channel-Token` is checked against our own secret so a
 * stranger can't trigger a resync by guessing this URL, and
 * `X-Goog-Channel-ID` says which connection changed.
 */
export async function POST(request: Request) {
  const channelToken = request.headers.get("x-goog-channel-token");
  const expected = process.env.GOOGLE_CALENDAR_WEBHOOK_TOKEN;
  if (!expected || channelToken !== expected) {
    return NextResponse.json({ error: "Invalid channel token" }, { status: 403 });
  }

  const resourceState = request.headers.get("x-goog-resource-state");
  const channelId = request.headers.get("x-goog-channel-id");
  // The initial "sync" ping on channel creation carries no real change and
  // there's nothing to look up yet - just acknowledge it.
  if (resourceState === "sync" || !channelId) {
    return NextResponse.json({ ok: true });
  }

  try {
    const snap = await getAdminFirestore()
      .collection("googleCalendarConnections")
      .where("channelId", "==", channelId)
      .limit(1)
      .get();
    const uid = snap.docs[0]?.id;
    if (uid) await pullChangesForConnection(uid);
  } catch (err) {
    console.error("Google Calendar webhook handling failed:", err);
    // Still ack with 200 below - Google doesn't need to retry, and the
    // reconcile cron will catch whatever this missed.
  }
  return NextResponse.json({ ok: true });
}

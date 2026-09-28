import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { startWatch } from "@/lib/google-calendar/watch";
import type { GoogleCalendarConnection } from "@/lib/types";

export const runtime = "nodejs";

const RENEW_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Vercel sends this as a Bearer header automatically for cron-triggered
 * requests when the project has a CRON_SECRET env var set - see
 * vercel.json. Rejects everything else, including a guessed URL hit
 * directly. */
function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
}

/** Google Calendar watch() channels expire after ~7 days - renews any
 * connection's channel expiring within the next 24h. Best-effort per
 * connection (see startWatch), so this is also how a connection made
 * before domain verification was completed picks up real-time delivery
 * for the first time. */
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const snap = await getAdminFirestore()
    .collection("googleCalendarConnections")
    .where("status", "==", "connected")
    .get();
  const dueForRenewal = snap.docs
    .map((d) => d.data() as GoogleCalendarConnection)
    .filter((c) => !c.channelExpiration || c.channelExpiration - Date.now() < RENEW_WINDOW_MS);

  for (const connection of dueForRenewal) {
    await startWatch(connection);
  }

  return NextResponse.json({ ok: true, checked: snap.size, renewed: dueForRenewal.length });
}

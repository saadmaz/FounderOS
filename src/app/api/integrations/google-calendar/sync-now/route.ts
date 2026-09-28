import { NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase/admin";
import { getConnection } from "@/lib/google-calendar/client";
import { pullChangesForConnection } from "@/lib/google-calendar/sync";

export const runtime = "nodejs";

/** Manual "Sync now" button target - pulls the caller's own Google-side
 * changes in immediately instead of waiting on the webhook/cron. */
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
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Manual Google Calendar sync failed:", err);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}

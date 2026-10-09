import { NextResponse } from "next/server";
import { verifyRequestUser } from "@/lib/auth/server";
import { getConnection } from "@/lib/google-calendar/client";

export const runtime = "nodejs";

/** The connection doc lives in an Admin-SDK-only Firestore collection (see
 * src/lib/types/index.ts's GoogleCalendarConnection doc comment) - this is
 * the only way the client can read its own connection status. */
export async function GET(request: Request) {
  const decoded = await verifyRequestUser(request);
  if (!decoded) {
    return NextResponse.json({ error: "Missing or invalid auth token" }, { status: 401 });
  }

  try {
    const connection = await getConnection(decoded.uid);
    if (!connection) return NextResponse.json({ connected: false });

    return NextResponse.json({
      connected: true,
      googleEmail: connection.googleEmail,
      status: connection.status,
      lastError: connection.lastError ?? null,
      lastSyncedAt: connection.lastSyncedAt ?? null,
    });
  } catch (err) {
    console.error("Failed to read Google Calendar connection status:", err);
    return NextResponse.json({ error: "Couldn't load status" }, { status: 500 });
  }
}

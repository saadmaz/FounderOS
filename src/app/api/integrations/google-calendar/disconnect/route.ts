import { NextResponse } from "next/server";
import { verifyRequestUser } from "@/lib/auth/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { getConnection } from "@/lib/google-calendar/client";
import { revokeConnectionTokens } from "@/lib/google-calendar/oauth";
import { stopWatch } from "@/lib/google-calendar/watch";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const decoded = await verifyRequestUser(request);
  if (!decoded) {
    return NextResponse.json({ error: "Missing or invalid auth token" }, { status: 401 });
  }

  try {
    const connection = await getConnection(decoded.uid);
    if (!connection) return NextResponse.json({ ok: true });

    await stopWatch(connection);
    await revokeConnectionTokens(connection.refreshToken);

    const db = getAdminFirestore();
    const [eventLinksSnap, taskLinksSnap] = await Promise.all([
      db.collection(`workspaces/${connection.workspaceId}/googleEventLinks`).where("uid", "==", decoded.uid).get(),
      db.collection(`workspaces/${connection.workspaceId}/googleTaskLinks`).where("uid", "==", decoded.uid).get(),
    ]);
    const batch = db.batch();
    eventLinksSnap.docs.forEach((d) => batch.delete(d.ref));
    taskLinksSnap.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(db.doc(`googleCalendarConnections/${decoded.uid}`));
    await batch.commit();

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to disconnect Google Calendar:", err);
    return NextResponse.json({ error: "Couldn't disconnect" }, { status: 500 });
  }
}

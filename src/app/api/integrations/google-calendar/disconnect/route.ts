import { NextResponse } from "next/server";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebase/admin";
import { getConnection } from "@/lib/google-calendar/client";
import { revokeConnectionTokens } from "@/lib/google-calendar/oauth";
import { stopWatch } from "@/lib/google-calendar/watch";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;
  if (!idToken) {
    return NextResponse.json({ error: "Missing auth token" }, { status: 401 });
  }

  try {
    const decoded = await getAdminAuth().verifyIdToken(idToken);
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

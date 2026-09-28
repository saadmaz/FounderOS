import { NextResponse } from "next/server";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebase/admin";
import { isGoogleCalendarConfigured } from "@/lib/google-calendar/client";
import { pushToRelevantUsers } from "@/lib/google-calendar/sync";
import { pushTasksToOwner } from "@/lib/google-calendar/task-sync";

export const runtime = "nodejs";

/**
 * Called (fire-and-forget) right after a client-side Firestore write to a
 * CalendarEvent, Meeting, or Task - see notifyGoogleSync() in
 * src/lib/data/calendar-events.ts, meetings.ts, and tasks.ts. Fans the
 * change out server-side to every connected user it's relevant to (or, for
 * a task, just its owner - see pushTasksToOwner); the caller doesn't need
 * to know who else has Google Calendar connected.
 */
export async function POST(request: Request) {
  if (!isGoogleCalendarConfigured()) {
    return NextResponse.json({ ok: true }); // integration inactive - no-op
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;
  if (!idToken) {
    return NextResponse.json({ error: "Missing auth token" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const workspaceId = typeof body?.workspaceId === "string" ? body.workspaceId : null;
  const kind =
    body?.kind === "event" || body?.kind === "meeting" || body?.kind === "task" ? body.kind : null;
  const itemIds = Array.isArray(body?.itemIds)
    ? body.itemIds.filter((id: unknown): id is string => typeof id === "string")
    : null;
  const deleted = body?.deleted === true;
  if (!workspaceId || !kind || !itemIds || itemIds.length === 0) {
    return NextResponse.json({ error: "workspaceId, kind, and itemIds are required" }, { status: 400 });
  }

  try {
    const decoded = await getAdminAuth().verifyIdToken(idToken);
    const memberSnap = await getAdminFirestore()
      .doc(`workspaces/${workspaceId}/members/${decoded.uid}`)
      .get();
    if (!memberSnap.exists) {
      return NextResponse.json({ error: "Not a member of this workspace" }, { status: 403 });
    }

    if (kind === "task") {
      await pushTasksToOwner(workspaceId, itemIds, deleted);
    } else {
      await pushToRelevantUsers(workspaceId, kind, itemIds, deleted);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Google Calendar push failed:", err);
    return NextResponse.json({ error: "Sync push failed" }, { status: 500 });
  }
}

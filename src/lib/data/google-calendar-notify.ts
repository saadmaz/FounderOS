"use client";

import { auth } from "@/lib/firebase/client";

type SyncKind = "event" | "meeting" | "task";

/**
 * Fire-and-forget notification to the Google Calendar push endpoint (see
 * src/app/api/integrations/google-calendar/push) right after a Firestore
 * write to a CalendarEvent, Meeting, or Task - see createCalendarEvent etc.
 * in ./calendar-events.ts, ./meetings.ts, and ./tasks.ts. Never throws and
 * never awaited by its callers: Google being unreachable, or the
 * integration simply not being connected, must never affect a core
 * create/update/delete in the app itself.
 */
export function notifyGoogleSync(
  workspaceId: string,
  kind: SyncKind,
  itemIds: string | string[],
  deleted = false
): void {
  const user = auth.currentUser;
  if (!user) return;
  const ids = Array.isArray(itemIds) ? itemIds : [itemIds];
  if (ids.length === 0) return;

  user
    .getIdToken()
    .then((idToken) =>
      fetch("/api/integrations/google-calendar/push", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ workspaceId, kind, itemIds: ids, deleted }),
      })
    )
    .catch((err) => console.error("Google Calendar sync notification failed:", err));
}

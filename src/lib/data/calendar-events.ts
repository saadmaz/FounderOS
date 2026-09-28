"use client";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { CalendarEvent, RecurrenceFrequency } from "@/lib/types";
import { now } from "./firestore-helpers";
import { notifyGoogleSync } from "./google-calendar-notify";
import { useCollection } from "./use-collection";

const path = (workspaceId: string) => `workspaces/${workspaceId}/calendarEvents`;

export function useCalendarEvents(workspaceId: string | null) {
  return useCollection<CalendarEvent>(
    workspaceId ? path(workspaceId) : null,
    [orderBy("startsAt", "asc")],
    [workspaceId]
  );
}

export async function createCalendarEvent(
  workspaceId: string,
  input: Pick<CalendarEvent, "title" | "type" | "startsAt" | "allDay" | "createdBy"> &
    Partial<CalendarEvent>
) {
  const ts = now();
  const ref = await addDoc(collection(db, path(workspaceId)), {
    ...input,
    workspaceId,
    createdAt: ts,
  });
  notifyGoogleSync(workspaceId, "event", ref.id);
  return ref;
}

/**
 * Materializes a recurring series as N real event documents, one per date
 * in `dates` (see src/lib/recurrence.ts) - preserves the original
 * start-to-end duration (if any) on every instance. Mirrors
 * createRecurringMeetings in ./meetings.ts.
 */
export async function createRecurringCalendarEvents(
  workspaceId: string,
  base: Pick<CalendarEvent, "title" | "type" | "allDay" | "createdBy"> & Partial<CalendarEvent>,
  dates: number[],
  durationMs: number | null,
  recurrence: { frequency: RecurrenceFrequency; interval: number }
) {
  const ts = now();
  const groupId = doc(collection(db, path(workspaceId))).id;
  const batch = writeBatch(db);
  const ids: string[] = [];
  dates.forEach((startsAt, index) => {
    const ref = doc(collection(db, path(workspaceId)));
    ids.push(ref.id);
    batch.set(ref, {
      ...base,
      workspaceId,
      startsAt,
      endsAt: durationMs != null ? startsAt + durationMs : null,
      recurrence: {
        frequency: recurrence.frequency,
        interval: recurrence.interval,
        groupId,
        index,
        count: dates.length,
      },
      createdAt: ts,
    });
  });
  await batch.commit();
  notifyGoogleSync(workspaceId, "event", ids);
}

export async function updateCalendarEvent(
  workspaceId: string,
  eventId: string,
  patch: Partial<CalendarEvent>
) {
  const result = await updateDoc(doc(db, path(workspaceId), eventId), {
    ...patch,
  });
  notifyGoogleSync(workspaceId, "event", eventId);
  return result;
}

export async function deleteCalendarEvent(workspaceId: string, eventId: string) {
  const result = await deleteDoc(doc(db, path(workspaceId), eventId));
  notifyGoogleSync(workspaceId, "event", eventId, true);
  return result;
}

/** Deletes every event in a recurring series (all instances sharing
 * `groupId`), not just one occurrence. */
export async function deleteCalendarEventSeries(workspaceId: string, groupId: string) {
  const snap = await getDocs(
    query(collection(db, path(workspaceId)), where("recurrence.groupId", "==", groupId))
  );
  const ids = snap.docs.map((d) => d.id);
  const batch = writeBatch(db);
  snap.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  notifyGoogleSync(workspaceId, "event", ids, true);
}

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
  return addDoc(collection(db, path(workspaceId)), {
    ...input,
    workspaceId,
    createdAt: ts,
  });
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
  dates.forEach((startsAt, index) => {
    const ref = doc(collection(db, path(workspaceId)));
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
}

export async function updateCalendarEvent(
  workspaceId: string,
  eventId: string,
  patch: Partial<CalendarEvent>
) {
  return updateDoc(doc(db, path(workspaceId), eventId), {
    ...patch,
  });
}

export async function deleteCalendarEvent(workspaceId: string, eventId: string) {
  return deleteDoc(doc(db, path(workspaceId), eventId));
}

/** Deletes every event in a recurring series (all instances sharing
 * `groupId`), not just one occurrence. */
export async function deleteCalendarEventSeries(workspaceId: string, groupId: string) {
  const snap = await getDocs(
    query(collection(db, path(workspaceId)), where("recurrence.groupId", "==", groupId))
  );
  const batch = writeBatch(db);
  snap.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}

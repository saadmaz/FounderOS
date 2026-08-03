"use client";

import { addDoc, collection, doc, orderBy, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { CalendarEvent } from "@/lib/types";
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

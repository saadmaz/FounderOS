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
import type { Meeting, MeetingStatus, RecurrenceFrequency } from "@/lib/types";
import { now } from "./firestore-helpers";
import { useCollection } from "./use-collection";

const path = (workspaceId: string) => `workspaces/${workspaceId}/meetings`;

export function useMeetings(workspaceId: string | null, companyId?: string) {
  const constraints = companyId
    ? [where("companyId", "==", companyId), orderBy("scheduledAt", "desc")]
    : [orderBy("scheduledAt", "desc")];
  return useCollection<Meeting>(workspaceId ? path(workspaceId) : null, constraints, [
    workspaceId,
    companyId,
  ]);
}

export async function createMeeting(
  workspaceId: string,
  input: Pick<
    Meeting,
    "companyId" | "title" | "scheduledAt" | "durationMinutes" | "attendeeIds" | "status"
  > &
    Partial<Meeting>
) {
  const ts = now();
  return addDoc(collection(db, path(workspaceId)), {
    ...input,
    workspaceId,
    createdAt: ts,
    updatedAt: ts,
  });
}

/**
 * Materializes a recurring series as N real meeting documents, one per date
 * in `dates` (see src/lib/recurrence.ts for how those are generated) - this
 * app has no background job to expand a recurrence rule lazily, so every
 * occurrence is a normal Meeting doc from the moment it's created, which is
 * what lets every existing meetings query/view show them with no changes.
 */
export async function createRecurringMeetings(
  workspaceId: string,
  base: Pick<Meeting, "companyId" | "title" | "durationMinutes" | "attendeeIds" | "status"> &
    Partial<Meeting>,
  dates: number[],
  recurrence: { frequency: RecurrenceFrequency; interval: number }
) {
  const ts = now();
  const groupId = doc(collection(db, path(workspaceId))).id;
  const batch = writeBatch(db);
  dates.forEach((scheduledAt, index) => {
    const ref = doc(collection(db, path(workspaceId)));
    batch.set(ref, {
      ...base,
      workspaceId,
      scheduledAt,
      recurrence: {
        frequency: recurrence.frequency,
        interval: recurrence.interval,
        groupId,
        index,
        count: dates.length,
      },
      createdAt: ts,
      updatedAt: ts,
    });
  });
  await batch.commit();
}

export async function updateMeeting(
  workspaceId: string,
  meetingId: string,
  patch: Partial<Meeting>
) {
  return updateDoc(doc(db, path(workspaceId), meetingId), {
    ...patch,
    updatedAt: now(),
  });
}

export async function setMeetingStatus(
  workspaceId: string,
  meetingId: string,
  status: MeetingStatus
) {
  return updateMeeting(workspaceId, meetingId, { status });
}

export async function deleteMeeting(workspaceId: string, meetingId: string) {
  return deleteDoc(doc(db, path(workspaceId), meetingId));
}

/** Deletes every meeting in a recurring series (all instances sharing
 * `groupId`), not just one occurrence. */
export async function deleteMeetingSeries(workspaceId: string, groupId: string) {
  const snap = await getDocs(
    query(collection(db, path(workspaceId)), where("recurrence.groupId", "==", groupId))
  );
  const batch = writeBatch(db);
  snap.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}

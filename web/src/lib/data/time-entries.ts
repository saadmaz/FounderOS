"use client";

import { addDoc, collection, deleteDoc, doc, orderBy, updateDoc, where } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { TimeEntry } from "@/lib/types";
import { now } from "./firestore-helpers";
import { useCollection } from "./use-collection";

const path = (workspaceId: string) => `workspaces/${workspaceId}/timeEntries`;

export function useTimeEntries(workspaceId: string | null, memberId?: string) {
  const constraints = memberId
    ? [where("memberId", "==", memberId), orderBy("startedAt", "desc")]
    : [orderBy("startedAt", "desc")];
  return useCollection<TimeEntry>(workspaceId ? path(workspaceId) : null, constraints, [
    workspaceId,
    memberId,
  ]);
}

/** Is there a timer currently running for this member? Client-side filter
 *  since "endedAt == null" needs its own composite index otherwise. */
export function findRunningEntry(entries: TimeEntry[], memberId: string) {
  return entries.find((e) => e.memberId === memberId && e.endedAt === null) ?? null;
}

export async function startTimer(
  workspaceId: string,
  input: Pick<TimeEntry, "memberId" | "companyId"> & Partial<TimeEntry>
) {
  const ts = now();
  return addDoc(collection(db, path(workspaceId)), {
    billable: true,
    ...input,
    workspaceId,
    startedAt: ts,
    endedAt: null,
    createdAt: ts,
  });
}

export async function stopTimer(workspaceId: string, entryId: string) {
  return updateDoc(doc(db, path(workspaceId), entryId), {
    endedAt: now(),
  });
}

export async function deleteTimeEntry(workspaceId: string, entryId: string) {
  return deleteDoc(doc(db, path(workspaceId), entryId));
}

export async function logManualEntry(
  workspaceId: string,
  input: Pick<TimeEntry, "memberId" | "companyId" | "startedAt" | "endedAt"> & Partial<TimeEntry>
) {
  return addDoc(collection(db, path(workspaceId)), {
    billable: true,
    ...input,
    workspaceId,
    createdAt: now(),
  });
}

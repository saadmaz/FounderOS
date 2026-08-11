"use client";

import { addDoc, collection, deleteDoc, doc, orderBy, where } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { TimeOffEntry } from "@/lib/types";
import { now, omitUndefined } from "./firestore-helpers";
import { useCollection } from "./use-collection";

const path = (workspaceId: string) => `workspaces/${workspaceId}/timeOff`;

export function useTimeOff(workspaceId: string | null, companyId?: string) {
  const constraints = companyId
    ? [where("companyId", "==", companyId), orderBy("date", "desc")]
    : [orderBy("date", "desc")];
  return useCollection<TimeOffEntry>(workspaceId ? path(workspaceId) : null, constraints, [
    workspaceId,
    companyId,
  ]);
}

/** Midnight local time for the given instant - the canonical key a day off
 * is stored/matched under, so "today" lines up regardless of what time it
 * currently is. */
export function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export async function markTimeOff(
  workspaceId: string,
  input: Pick<TimeOffEntry, "companyId" | "memberId" | "date" | "reason"> &
    Partial<Pick<TimeOffEntry, "note">>
) {
  return addDoc(
    collection(db, path(workspaceId)),
    omitUndefined({
      ...input,
      note: input.note || undefined,
      workspaceId,
      createdAt: now(),
    })
  );
}

export async function deleteTimeOff(workspaceId: string, entryId: string) {
  return deleteDoc(doc(db, path(workspaceId), entryId));
}

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
import type { RecurrenceFrequency, Task, TaskStatus } from "@/lib/types";
import { now } from "./firestore-helpers";
import { useCollection } from "./use-collection";

const path = (workspaceId: string) => `workspaces/${workspaceId}/tasks`;

export function useTasks(workspaceId: string | null, companyId?: string) {
  const constraints = companyId
    ? [where("companyId", "==", companyId), orderBy("order", "asc")]
    : [orderBy("order", "asc")];
  return useCollection<Task>(workspaceId ? path(workspaceId) : null, constraints, [
    workspaceId,
    companyId,
  ]);
}

/** Direct contactId query rather than piggybacking on useTasks(companyId)
 * + a client-side filter - a task stays visible on its contact even if
 * that contact's company field is later changed. */
export function useTasksByContact(workspaceId: string | null, contactId: string | null) {
  return useCollection<Task>(
    workspaceId && contactId ? path(workspaceId) : null,
    [where("contactId", "==", contactId), orderBy("order", "asc")],
    [workspaceId, contactId]
  );
}

export async function createTask(
  workspaceId: string,
  input: Pick<Task, "companyId" | "title" | "status" | "priority"> & Partial<Task>
) {
  const ts = now();
  return addDoc(collection(db, path(workspaceId)), {
    order: ts,
    ...input,
    workspaceId,
    createdAt: ts,
    updatedAt: ts,
  });
}

export async function updateTask(workspaceId: string, taskId: string, patch: Partial<Task>) {
  return updateDoc(doc(db, path(workspaceId), taskId), {
    ...patch,
    updatedAt: now(),
  });
}

export async function setTaskStatus(workspaceId: string, taskId: string, status: TaskStatus) {
  return updateTask(workspaceId, taskId, {
    status,
    completedAt: status === "completed" ? now() : null,
  });
}

export async function deleteTask(workspaceId: string, taskId: string) {
  return deleteDoc(doc(db, path(workspaceId), taskId));
}

/**
 * Materializes a recurring series as N real task documents, one per date in
 * `dates` (see src/lib/recurrence.ts) - same eager approach as
 * createRecurringMeetings, since this app has no background job to expand a
 * recurrence rule lazily.
 */
export async function createRecurringTasks(
  workspaceId: string,
  base: Pick<Task, "companyId" | "title" | "status" | "priority"> & Partial<Task>,
  dates: number[],
  recurrence: { frequency: RecurrenceFrequency; interval: number }
) {
  const ts = now();
  const groupId = doc(collection(db, path(workspaceId))).id;
  const batch = writeBatch(db);
  dates.forEach((dueDate, index) => {
    const ref = doc(collection(db, path(workspaceId)));
    batch.set(ref, {
      ...base,
      order: ts,
      workspaceId,
      dueDate,
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

/** Deletes every task in a recurring series (all instances sharing
 * `groupId`), not just one occurrence. */
export async function deleteTaskSeries(workspaceId: string, groupId: string) {
  const snap = await getDocs(
    query(collection(db, path(workspaceId)), where("recurrence.groupId", "==", groupId))
  );
  const batch = writeBatch(db);
  snap.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}

/** Same as setTaskStatus but for many tasks in one Firestore batch,
 * chunked at 400 writes/batch (Firestore's limit is 500) - mirrors
 * bulkMarkExpensesReimbursed in lib/data/expenses.ts. */
export async function bulkSetTaskStatus(workspaceId: string, taskIds: string[], status: TaskStatus) {
  const ts = now();
  for (let i = 0; i < taskIds.length; i += 400) {
    const batch = writeBatch(db);
    for (const id of taskIds.slice(i, i + 400)) {
      batch.update(doc(db, path(workspaceId), id), {
        status,
        completedAt: status === "completed" ? ts : null,
        updatedAt: ts,
      });
    }
    await batch.commit();
  }
}

export async function bulkDeleteTasks(workspaceId: string, taskIds: string[]) {
  for (let i = 0; i < taskIds.length; i += 400) {
    const batch = writeBatch(db);
    for (const id of taskIds.slice(i, i + 400)) {
      batch.delete(doc(db, path(workspaceId), id));
    }
    await batch.commit();
  }
}

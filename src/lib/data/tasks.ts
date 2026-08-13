"use client";

import { addDoc, collection, doc, orderBy, updateDoc, where, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { Task, TaskStatus } from "@/lib/types";
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

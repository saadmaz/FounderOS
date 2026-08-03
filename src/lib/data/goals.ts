"use client";

import { addDoc, collection, doc, orderBy, updateDoc, where, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { Goal } from "@/lib/types";
import { now } from "./firestore-helpers";
import { useCollection } from "./use-collection";

const path = (workspaceId: string) => `workspaces/${workspaceId}/goals`;

export function useGoals(workspaceId: string | null, companyId?: string) {
  const constraints = companyId
    ? [where("companyId", "==", companyId), orderBy("createdAt", "desc")]
    : [orderBy("createdAt", "desc")];
  return useCollection<Goal>(workspaceId ? path(workspaceId) : null, constraints, [
    workspaceId,
    companyId,
  ]);
}

export async function createGoal(
  workspaceId: string,
  input: Pick<Goal, "title" | "category" | "status"> & Partial<Goal>
) {
  const ts = now();
  return addDoc(collection(db, path(workspaceId)), {
    ...input,
    workspaceId,
    createdAt: ts,
    updatedAt: ts,
  });
}

export async function updateGoal(workspaceId: string, goalId: string, patch: Partial<Goal>) {
  return updateDoc(doc(db, path(workspaceId), goalId), {
    ...patch,
    updatedAt: now(),
  });
}

export async function deleteGoal(workspaceId: string, goalId: string) {
  return deleteDoc(doc(db, path(workspaceId), goalId));
}

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

/** Auto-promotes a goal to "completed" once its progress reaches the
 * target, so hitting 100% actually reads as done instead of leaving the
 * status badge on whatever it was before the last update. */
export function deriveGoalStatus(
  currentValue: number | undefined,
  targetValue: number | undefined,
  status: Goal["status"]
): Goal["status"] {
  if (
    typeof targetValue === "number" &&
    targetValue > 0 &&
    typeof currentValue === "number" &&
    currentValue >= targetValue &&
    status !== "completed"
  ) {
    return "completed";
  }
  return status;
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

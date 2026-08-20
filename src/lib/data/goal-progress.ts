"use client";

import { addDoc, collection, orderBy, where } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { GoalProgressEntry } from "@/lib/types";
import { now } from "./firestore-helpers";
import { useCollection } from "./use-collection";

const path = (workspaceId: string) => `workspaces/${workspaceId}/goalProgress`;

export function useGoalProgress(workspaceId: string | null, goalId: string | null) {
  return useCollection<GoalProgressEntry>(
    workspaceId && goalId ? path(workspaceId) : null,
    [where("goalId", "==", goalId), orderBy("recordedAt", "asc")],
    [workspaceId, goalId]
  );
}

export async function recordProgressSnapshot(workspaceId: string, goalId: string, value: number) {
  return addDoc(collection(db, path(workspaceId)), {
    workspaceId,
    goalId,
    value,
    recordedAt: now(),
  });
}

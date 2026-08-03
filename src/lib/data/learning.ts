"use client";

import { addDoc, collection, deleteDoc, doc, orderBy, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { LearningItem } from "@/lib/types";
import { now } from "./firestore-helpers";
import { useCollection } from "./use-collection";

const path = (workspaceId: string) => `workspaces/${workspaceId}/learningItems`;

export function useLearningItems(workspaceId: string | null) {
  return useCollection<LearningItem>(
    workspaceId ? path(workspaceId) : null,
    [orderBy("createdAt", "desc")],
    [workspaceId]
  );
}

export async function createLearningItem(
  workspaceId: string,
  input: Pick<LearningItem, "title" | "type" | "status"> & Partial<LearningItem>
) {
  const ts = now();
  return addDoc(collection(db, path(workspaceId)), {
    ...input,
    workspaceId,
    createdAt: ts,
    updatedAt: ts,
  });
}

export async function updateLearningItem(
  workspaceId: string,
  itemId: string,
  patch: Partial<LearningItem>
) {
  return updateDoc(doc(db, path(workspaceId), itemId), {
    ...patch,
    updatedAt: now(),
  });
}

export async function deleteLearningItem(workspaceId: string, itemId: string) {
  return deleteDoc(doc(db, path(workspaceId), itemId));
}

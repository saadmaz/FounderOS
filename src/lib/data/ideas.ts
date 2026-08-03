"use client";

import {
  addDoc,
  collection,
  doc,
  increment,
  orderBy,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { Idea, IdeaStatus } from "@/lib/types";
import { now } from "./firestore-helpers";
import { useCollection } from "./use-collection";

const path = (workspaceId: string) => `workspaces/${workspaceId}/ideas`;

export function useIdeas(workspaceId: string | null, companyId?: string) {
  const constraints = companyId
    ? [where("companyId", "==", companyId), orderBy("createdAt", "desc")]
    : [orderBy("createdAt", "desc")];
  return useCollection<Idea>(workspaceId ? path(workspaceId) : null, constraints, [
    workspaceId,
    companyId,
  ]);
}

export async function createIdea(
  workspaceId: string,
  input: Pick<Idea, "title" | "createdBy"> & Partial<Idea>
) {
  const ts = now();
  return addDoc(collection(db, path(workspaceId)), {
    status: "new" as IdeaStatus,
    votes: 0,
    ...input,
    workspaceId,
    createdAt: ts,
    updatedAt: ts,
  });
}

export async function updateIdea(workspaceId: string, ideaId: string, patch: Partial<Idea>) {
  return updateDoc(doc(db, path(workspaceId), ideaId), {
    ...patch,
    updatedAt: now(),
  });
}

export async function setIdeaStatus(workspaceId: string, ideaId: string, status: IdeaStatus) {
  return updateIdea(workspaceId, ideaId, { status });
}

export async function upvoteIdea(workspaceId: string, ideaId: string) {
  return updateDoc(doc(db, path(workspaceId), ideaId), {
    votes: increment(1),
    updatedAt: now(),
  });
}

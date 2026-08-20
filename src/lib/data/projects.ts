"use client";

import { addDoc, collection, deleteDoc, doc, orderBy, updateDoc, where } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { Project } from "@/lib/types";
import { now } from "./firestore-helpers";
import { useCollection } from "./use-collection";

const path = (workspaceId: string) => `workspaces/${workspaceId}/projects`;

export function useProjects(workspaceId: string | null, companyId?: string) {
  const constraints = companyId
    ? [where("companyId", "==", companyId), orderBy("createdAt", "desc")]
    : [orderBy("createdAt", "desc")];
  return useCollection<Project>(
    workspaceId ? path(workspaceId) : null,
    constraints,
    [workspaceId, companyId]
  );
}

export async function createProject(
  workspaceId: string,
  input: Pick<Project, "companyId" | "name" | "priority" | "status"> & Partial<Project>
) {
  const ts = now();
  return addDoc(collection(db, path(workspaceId)), {
    ...input,
    workspaceId,
    createdAt: ts,
    updatedAt: ts,
  });
}

export async function updateProject(
  workspaceId: string,
  projectId: string,
  patch: Partial<Project>
) {
  return updateDoc(doc(db, path(workspaceId), projectId), {
    ...patch,
    updatedAt: now(),
  });
}

export async function deleteProject(workspaceId: string, projectId: string) {
  return deleteDoc(doc(db, path(workspaceId), projectId));
}

"use client";

import { addDoc, collection, deleteDoc, doc, where } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { CompanyNote } from "@/lib/types";
import { now } from "./firestore-helpers";
import { useCollection } from "./use-collection";

const path = (workspaceId: string) => `workspaces/${workspaceId}/companyNotes`;

/** No `orderBy` in the query itself - sorting client-side avoids requiring
 * a composite index for a collection this small. */
export function useCompanyNotes(workspaceId: string | null, companyId: string | null) {
  const result = useCollection<CompanyNote>(
    workspaceId && companyId ? path(workspaceId) : null,
    [where("companyId", "==", companyId)],
    [workspaceId, companyId]
  );
  return {
    ...result,
    data: [...result.data].sort((a, b) => b.date - a.date || b.createdAt - a.createdAt),
  };
}

export async function addCompanyNote(
  workspaceId: string,
  input: { companyId: string; date: number; text: string; authorId: string }
) {
  return addDoc(collection(db, path(workspaceId)), {
    ...input,
    workspaceId,
    createdAt: now(),
  });
}

export async function deleteCompanyNote(workspaceId: string, noteId: string) {
  return deleteDoc(doc(db, path(workspaceId), noteId));
}

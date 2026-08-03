"use client";

import { addDoc, collection, deleteDoc, doc, orderBy, where } from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "@/lib/firebase/client";
import type { DocumentFile } from "@/lib/types";
import { now } from "./firestore-helpers";
import { useCollection } from "./use-collection";

const path = (workspaceId: string) => `workspaces/${workspaceId}/documents`;

export function useDocuments(workspaceId: string | null, companyId?: string) {
  const constraints = companyId
    ? [where("companyId", "==", companyId), orderBy("createdAt", "desc")]
    : [orderBy("createdAt", "desc")];
  return useCollection<DocumentFile>(workspaceId ? path(workspaceId) : null, constraints, [
    workspaceId,
    companyId,
  ]);
}

/**
 * Uploads the file's bytes to Storage, then writes the metadata doc that
 * the rest of the app (list, filters, etc.) actually queries against.
 */
export async function uploadDocument(
  workspaceId: string,
  input: { file: File; companyId?: string; uploadedBy: string }
) {
  const storagePath = `workspaces/${workspaceId}/documents/${input.uploadedBy}-${Date.now()}-${input.file.name}`;
  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, input.file);

  const ts = now();
  return addDoc(collection(db, path(workspaceId)), {
    workspaceId,
    ...(input.companyId ? { companyId: input.companyId } : {}),
    name: input.file.name,
    storagePath,
    contentType: input.file.type || "application/octet-stream",
    size: input.file.size,
    uploadedBy: input.uploadedBy,
    createdAt: ts,
  });
}

/** Resolves a fresh download URL for a document on demand. */
export async function getDocumentDownloadURL(storagePath: string) {
  return getDownloadURL(ref(storage, storagePath));
}

/** Removes both the Storage object and its Firestore metadata doc. */
export async function deleteDocument(workspaceId: string, document: DocumentFile) {
  try {
    await deleteObject(ref(storage, document.storagePath));
  } catch {
    // Storage object may already be gone (e.g. manual cleanup) - the
    // metadata doc is still the source of truth for the list, so remove it.
  }
  return deleteDoc(doc(db, path(workspaceId), document.id));
}

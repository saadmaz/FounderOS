"use client";

import { addDoc, collection, deleteDoc, doc, orderBy, where } from "firebase/firestore";
import { trackEvent } from "@/lib/analytics";
import { deleteCloudinaryAsset, uploadDocumentToCloudinary } from "@/lib/cloudinary";
import { db } from "@/lib/firebase/client";
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
 * Uploads the file to Cloudinary, then writes the metadata doc that the
 * rest of the app (list, filters, etc.) actually queries against.
 */
export async function uploadDocument(
  workspaceId: string,
  input: { file: File; companyId?: string; uploadedBy: string }
) {
  const { url, publicId, resourceType } = await uploadDocumentToCloudinary(
    input.file,
    `founderos/${workspaceId}/documents`
  );

  const ts = now();
  const ref = await addDoc(collection(db, path(workspaceId)), {
    workspaceId,
    ...(input.companyId ? { companyId: input.companyId } : {}),
    name: input.file.name,
    url,
    publicId,
    resourceType,
    contentType: input.file.type || "application/octet-stream",
    size: input.file.size,
    uploadedBy: input.uploadedBy,
    createdAt: ts,
  });
  trackEvent("document_uploaded", { resource_type: resourceType, size: input.file.size });
  return ref;
}

/** Removes both the Cloudinary asset (via a server route - deleting needs
 * the API secret) and the Firestore metadata doc. Throws if the Cloudinary
 * delete fails, rather than silently deleting only the metadata - fetch()
 * doesn't reject on a non-2xx response, so that check has to be explicit. */
export async function deleteDocument(workspaceId: string, document: DocumentFile) {
  await deleteCloudinaryAsset(document.publicId, document.resourceType);
  const result = await deleteDoc(doc(db, path(workspaceId), document.id));
  trackEvent("document_deleted");
  return result;
}

"use client";

import { addDoc, collection, deleteDoc, deleteField, doc, orderBy, updateDoc, where } from "firebase/firestore";
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

/** Direct contactId query rather than piggybacking on useDocuments(companyId)
 * + a client-side filter - a document stays attached to its contact even if
 * that contact's company field is later changed. */
export function useDocumentsByContact(workspaceId: string | null, contactId: string | null) {
  return useCollection<DocumentFile>(
    workspaceId && contactId ? path(workspaceId) : null,
    [where("contactId", "==", contactId), orderBy("createdAt", "desc")],
    [workspaceId, contactId]
  );
}

/**
 * Uploads the file to Cloudinary, then writes the metadata doc that the
 * rest of the app (list, filters, etc.) actually queries against.
 */
export async function uploadDocument(
  workspaceId: string,
  input: {
    file: File;
    name?: string;
    companyId?: string;
    contactId?: string;
    description?: string;
    uploadedBy: string;
  }
) {
  const { url, publicId, resourceType } = await uploadDocumentToCloudinary(
    input.file,
    `founderos/${workspaceId}/documents`
  );

  const ts = now();
  const ref = await addDoc(collection(db, path(workspaceId)), {
    workspaceId,
    ...(input.companyId ? { companyId: input.companyId } : {}),
    ...(input.contactId ? { contactId: input.contactId } : {}),
    name: input.name?.trim() || input.file.name,
    ...(input.description ? { description: input.description } : {}),
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

/**
 * Edits a document's metadata (title, description, company) - the
 * underlying Cloudinary asset is untouched. `companyId` uses deleteField()
 * rather than being omitted or written as `null`: updateDoc only ever
 * touches the keys it's given, so clearing "no company" has to actually
 * remove the field to match how uploadDocument never writes it in the
 * first place.
 */
export async function updateDocument(
  workspaceId: string,
  documentId: string,
  patch: { name: string; description: string; companyId?: string }
) {
  const result = await updateDoc(doc(db, path(workspaceId), documentId), {
    name: patch.name,
    description: patch.description,
    companyId: patch.companyId ? patch.companyId : deleteField(),
  });
  trackEvent("document_updated");
  return result;
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

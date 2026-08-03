"use client";

import { addDoc, collection, doc, orderBy, updateDoc, where, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { Contact } from "@/lib/types";
import { now } from "./firestore-helpers";
import { useCollection } from "./use-collection";

const path = (workspaceId: string) => `workspaces/${workspaceId}/contacts`;

export function useContacts(workspaceId: string | null, companyId?: string) {
  const constraints = companyId
    ? [where("companyId", "==", companyId), orderBy("name", "asc")]
    : [orderBy("name", "asc")];
  return useCollection<Contact>(workspaceId ? path(workspaceId) : null, constraints, [
    workspaceId,
    companyId,
  ]);
}

export async function createContact(
  workspaceId: string,
  input: Pick<Contact, "companyId" | "name" | "status"> & Partial<Contact>
) {
  const ts = now();
  return addDoc(collection(db, path(workspaceId)), {
    ...input,
    workspaceId,
    createdAt: ts,
    updatedAt: ts,
  });
}

export async function updateContact(
  workspaceId: string,
  contactId: string,
  patch: Partial<Contact>
) {
  return updateDoc(doc(db, path(workspaceId), contactId), {
    ...patch,
    updatedAt: now(),
  });
}

export async function deleteContact(workspaceId: string, contactId: string) {
  return deleteDoc(doc(db, path(workspaceId), contactId));
}

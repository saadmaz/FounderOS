"use client";

import { addDoc, collection, doc, orderBy, updateDoc, where, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { Contact, ContactActivity, ContactActivityType } from "@/lib/types";
import { now, omitUndefined, withFieldDeletes } from "./firestore-helpers";
import { useCollection } from "./use-collection";

const path = (workspaceId: string) => `workspaces/${workspaceId}/contacts`;
const activityPath = (workspaceId: string) => `workspaces/${workspaceId}/contactActivity`;

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
  input: Pick<Contact, "companyId" | "name" | "status"> & Partial<Contact>,
  actorId: string
) {
  const ts = now();
  const ref = await addDoc(collection(db, path(workspaceId)), {
    ...input,
    workspaceId,
    createdAt: ts,
    updatedAt: ts,
  });
  await addContactActivity(workspaceId, { contactId: ref.id, type: "created", authorId: actorId });
  return ref;
}

export async function updateContact(
  workspaceId: string,
  contactId: string,
  patch: Partial<Contact>
) {
  return updateDoc(doc(db, path(workspaceId), contactId), {
    ...withFieldDeletes(patch),
    updatedAt: now(),
  });
}

export async function deleteContact(workspaceId: string, contactId: string) {
  return deleteDoc(doc(db, path(workspaceId), contactId));
}

// ===================== Activity / notes thread =====================

/** Sorted by `date` (when it actually happened, for backdated entries)
 * falling back to `createdAt` - client-side, like useCompanyNotes, so a
 * backdated entry lands in its real chronological slot instead of always
 * at the top. */
export function useContactActivity(workspaceId: string | null, contactId: string | null) {
  const result = useCollection<ContactActivity>(
    workspaceId && contactId ? activityPath(workspaceId) : null,
    [where("contactId", "==", contactId), orderBy("createdAt", "desc")],
    [workspaceId, contactId]
  );
  return {
    ...result,
    data: [...result.data].sort((a, b) => (b.date ?? b.createdAt) - (a.date ?? a.createdAt)),
  };
}

export async function addContactActivity(
  workspaceId: string,
  input: { contactId: string; type: ContactActivityType; text?: string; date?: number; authorId: string }
) {
  return addDoc(collection(db, activityPath(workspaceId)), {
    ...omitUndefined(input),
    workspaceId,
    createdAt: now(),
  });
}

export async function deleteContactActivity(workspaceId: string, activityId: string) {
  return deleteDoc(doc(db, activityPath(workspaceId), activityId));
}

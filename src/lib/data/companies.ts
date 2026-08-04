"use client";

import {
  addDoc,
  collection,
  doc,
  orderBy,
  updateDoc,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "@/lib/firebase/client";
import type { Company } from "@/lib/types";
import { now } from "./firestore-helpers";
import { useCollection } from "./use-collection";

const path = (workspaceId: string) => `workspaces/${workspaceId}/companies`;

/**
 * Companies don't have an id yet while they're still being onboarded, so the
 * logo is uploaded under a caller-supplied draft id (see CompanyFormDialog)
 * ahead of the Firestore doc existing, then the resulting URL is saved as a
 * normal field on create/update.
 */
export async function uploadCompanyLogo(workspaceId: string, draftId: string, file: File) {
  const ext = file.name.split(".").pop() ?? "png";
  const storageRef = ref(storage, `workspaces/${workspaceId}/logos/${draftId}-${Date.now()}.${ext}`);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

export function useCompanies(workspaceId: string | null) {
  return useCollection<Company>(
    workspaceId ? path(workspaceId) : null,
    [orderBy("name", "asc")],
    [workspaceId]
  );
}

export async function createCompany(
  workspaceId: string,
  input: Pick<Company, "name" | "type" | "status" | "stage" | "currency" | "color"> &
    Partial<Company>
) {
  const ts = now();
  return addDoc(collection(db, path(workspaceId)), {
    ...input,
    workspaceId,
    createdAt: ts,
    updatedAt: ts,
    archivedAt: null,
  });
}

export async function updateCompany(
  workspaceId: string,
  companyId: string,
  patch: Partial<Company>
) {
  return updateDoc(doc(db, path(workspaceId), companyId), {
    ...patch,
    updatedAt: now(),
  });
}

export async function archiveCompany(workspaceId: string, companyId: string) {
  return updateCompany(workspaceId, companyId, {
    status: "archived",
    archivedAt: now(),
  });
}

export async function restoreCompany(workspaceId: string, companyId: string) {
  return updateCompany(workspaceId, companyId, {
    status: "active",
    archivedAt: null,
  });
}

"use client";

import {
  addDoc,
  collection,
  doc,
  orderBy,
  updateDoc,
} from "firebase/firestore";
import { trackEvent } from "@/lib/analytics";
import { db } from "@/lib/firebase/client";
import type { Company } from "@/lib/types";
import { now } from "./firestore-helpers";
import { useCollection } from "./use-collection";

const path = (workspaceId: string) => `workspaces/${workspaceId}/companies`;

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
  const ref = await addDoc(collection(db, path(workspaceId)), {
    ...input,
    workspaceId,
    createdAt: ts,
    updatedAt: ts,
    archivedAt: null,
  });
  trackEvent("company_created", { company_type: input.type, stage: input.stage });
  return ref;
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
  const result = await updateCompany(workspaceId, companyId, {
    status: "archived",
    archivedAt: now(),
  });
  trackEvent("company_archived");
  return result;
}

export async function restoreCompany(workspaceId: string, companyId: string) {
  return updateCompany(workspaceId, companyId, {
    status: "active",
    archivedAt: null,
  });
}

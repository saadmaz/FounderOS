"use client";

import {
  doc,
  getDoc,
  orderBy,
  setDoc,
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

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "") || "company";
}

/** Finds a company doc ID derived from the name (e.g. "Spectrify AI" ->
 * "spectrifyai"), appending 2, 3, ... when another company in the workspace
 * already has that slug - keeps company URLs short and readable instead of
 * raw Firestore IDs. */
async function uniqueCompanySlug(workspaceId: string, name: string): Promise<string> {
  const base = slugify(name);
  let candidate = base;
  let n = 2;
  while ((await getDoc(doc(db, path(workspaceId), candidate))).exists()) {
    candidate = `${base}${n}`;
    n++;
  }
  return candidate;
}

export async function createCompany(
  workspaceId: string,
  input: Pick<Company, "name" | "type" | "status" | "stage" | "currency" | "color"> &
    Partial<Company>
) {
  const ts = now();
  const id = await uniqueCompanySlug(workspaceId, input.name);
  const ref = doc(db, path(workspaceId), id);
  await setDoc(ref, {
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

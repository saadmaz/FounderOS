"use client";

import { addDoc, collection, doc, orderBy, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { Vendor } from "@/lib/types";
import { now } from "./firestore-helpers";
import { useCollection } from "./use-collection";

const path = (workspaceId: string) => `workspaces/${workspaceId}/vendors`;

export function useVendors(workspaceId: string | null) {
  return useCollection<Vendor>(
    workspaceId ? path(workspaceId) : null,
    [orderBy("name", "asc")],
    [workspaceId]
  );
}

export async function createVendor(
  workspaceId: string,
  input: Pick<Vendor, "companyId" | "name"> & Partial<Vendor>
) {
  const ts = now();
  return addDoc(collection(db, path(workspaceId)), {
    ...input,
    workspaceId,
    createdAt: ts,
    updatedAt: ts,
  });
}

export async function updateVendor(workspaceId: string, vendorId: string, patch: Partial<Vendor>) {
  return updateDoc(doc(db, path(workspaceId), vendorId), {
    ...patch,
    updatedAt: now(),
  });
}

export async function deleteVendor(workspaceId: string, vendorId: string) {
  return deleteDoc(doc(db, path(workspaceId), vendorId));
}

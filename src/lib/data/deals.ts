"use client";

import { addDoc, collection, doc, orderBy, updateDoc, where, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { Deal, DealStage } from "@/lib/types";
import { now } from "./firestore-helpers";
import { useCollection } from "./use-collection";

const path = (workspaceId: string) => `workspaces/${workspaceId}/deals`;

export function useDeals(workspaceId: string | null, companyId?: string) {
  const constraints = companyId
    ? [where("companyId", "==", companyId), orderBy("createdAt", "desc")]
    : [orderBy("createdAt", "desc")];
  return useCollection<Deal>(workspaceId ? path(workspaceId) : null, constraints, [
    workspaceId,
    companyId,
  ]);
}

export async function createDeal(
  workspaceId: string,
  input: Pick<Deal, "companyId" | "title" | "value" | "currency" | "stage"> & Partial<Deal>
) {
  const ts = now();
  return addDoc(collection(db, path(workspaceId)), {
    ...input,
    workspaceId,
    createdAt: ts,
    updatedAt: ts,
  });
}

export async function updateDeal(workspaceId: string, dealId: string, patch: Partial<Deal>) {
  return updateDoc(doc(db, path(workspaceId), dealId), {
    ...patch,
    updatedAt: now(),
  });
}

export async function updateDealStage(workspaceId: string, dealId: string, stage: DealStage) {
  return updateDeal(workspaceId, dealId, { stage });
}

export async function deleteDeal(workspaceId: string, dealId: string) {
  return deleteDoc(doc(db, path(workspaceId), dealId));
}

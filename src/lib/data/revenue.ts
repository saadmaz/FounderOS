"use client";

import { addDoc, collection, doc, orderBy, updateDoc, where, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { RevenueEntry } from "@/lib/types";
import { now } from "./firestore-helpers";
import { useCollection } from "./use-collection";

const path = (workspaceId: string) => `workspaces/${workspaceId}/revenue`;

export function useRevenue(workspaceId: string | null, companyId?: string) {
  const constraints = companyId
    ? [where("companyId", "==", companyId), orderBy("date", "desc")]
    : [orderBy("date", "desc")];
  return useCollection<RevenueEntry>(workspaceId ? path(workspaceId) : null, constraints, [
    workspaceId,
    companyId,
  ]);
}

export async function createRevenueEntry(
  workspaceId: string,
  input: Pick<RevenueEntry, "companyId" | "category" | "amount" | "currency" | "date"> &
    Partial<RevenueEntry>
) {
  const ts = now();
  return addDoc(collection(db, path(workspaceId)), {
    ...input,
    workspaceId,
    createdAt: ts,
    updatedAt: ts,
  });
}

export async function updateRevenueEntry(
  workspaceId: string,
  revenueId: string,
  patch: Partial<RevenueEntry>
) {
  return updateDoc(doc(db, path(workspaceId), revenueId), {
    ...patch,
    updatedAt: now(),
  });
}

export async function deleteRevenueEntry(workspaceId: string, revenueId: string) {
  return deleteDoc(doc(db, path(workspaceId), revenueId));
}

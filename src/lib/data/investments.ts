"use client";

import { addDoc, collection, doc, orderBy, updateDoc, where, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { Investment } from "@/lib/types";
import { now, omitUndefined } from "./firestore-helpers";
import { useCollection } from "./use-collection";

const path = (workspaceId: string) => `workspaces/${workspaceId}/investments`;

export function useInvestments(workspaceId: string | null, companyId?: string) {
  const constraints = companyId
    ? [where("companyId", "==", companyId), orderBy("date", "desc")]
    : [orderBy("date", "desc")];
  return useCollection<Investment>(workspaceId ? path(workspaceId) : null, constraints, [
    workspaceId,
    companyId,
  ]);
}

export async function createInvestment(
  workspaceId: string,
  input: Pick<Investment, "companyId" | "type" | "status" | "amount" | "currency" | "date"> &
    Partial<Investment>
) {
  const ts = now();
  return addDoc(collection(db, path(workspaceId)), {
    ...input,
    workspaceId,
    createdAt: ts,
    updatedAt: ts,
  });
}

export async function updateInvestment(workspaceId: string, investmentId: string, patch: Partial<Investment>) {
  // omitUndefined so `field: undefined` (clearing an optional value) never
  // hits updateDoc, which throws on any undefined field value.
  return updateDoc(
    doc(db, path(workspaceId), investmentId),
    omitUndefined({
      ...patch,
      updatedAt: now(),
    })
  );
}

export async function deleteInvestment(workspaceId: string, investmentId: string) {
  return deleteDoc(doc(db, path(workspaceId), investmentId));
}

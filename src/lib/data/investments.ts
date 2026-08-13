"use client";

import { addDoc, collection, doc, orderBy, updateDoc, where, deleteDoc } from "firebase/firestore";
import { deleteCloudinaryAsset } from "@/lib/cloudinary";
import { db } from "@/lib/firebase/client";
import type { Investment, InvestmentStatus } from "@/lib/types";
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

/** Quick-action counterpart to opening the full edit dialog just to flip
 * one field - mirrors the Expenses "Reimbursed" button/setExpenseStatus
 * pattern, sized to how much simpler this transition is (no audit trail to
 * keep in sync, so a plain updateInvestment is enough here). */
export async function setInvestmentStatus(
  workspaceId: string,
  investmentId: string,
  status: InvestmentStatus
) {
  return updateInvestment(workspaceId, investmentId, { status });
}

/** Quick-action counterpart to opening the full edit dialog just to mark an
 * investment to market. */
export async function setInvestmentCurrentValue(
  workspaceId: string,
  investmentId: string,
  currentValue: number
) {
  return updateInvestment(workspaceId, investmentId, { currentValue });
}

/** Deletes the investment and, best-effort, every attached document - a
 * Cloudinary hiccup shouldn't block someone from deleting the underlying
 * investment record (mirrors deleteExpense). */
export async function deleteInvestment(
  workspaceId: string,
  investmentId: string,
  documents?: Investment["documents"]
) {
  await Promise.all(
    (documents ?? []).map((d) => deleteCloudinaryAsset(d.publicId, d.resourceType).catch(() => {}))
  );
  return deleteDoc(doc(db, path(workspaceId), investmentId));
}

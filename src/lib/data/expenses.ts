"use client";

import { addDoc, collection, doc, orderBy, updateDoc, where, deleteDoc } from "firebase/firestore";
import { deleteCloudinaryAsset } from "@/lib/cloudinary";
import { db } from "@/lib/firebase/client";
import type { Expense, ExpenseStatus } from "@/lib/types";
import { now, omitUndefined } from "./firestore-helpers";
import { useCollection } from "./use-collection";

const path = (workspaceId: string) => `workspaces/${workspaceId}/expenses`;

export function useExpenses(workspaceId: string | null, companyId?: string) {
  const constraints = companyId
    ? [where("companyId", "==", companyId), orderBy("date", "desc")]
    : [orderBy("date", "desc")];
  return useCollection<Expense>(workspaceId ? path(workspaceId) : null, constraints, [
    workspaceId,
    companyId,
  ]);
}

export async function createExpense(
  workspaceId: string,
  input: Pick<
    Expense,
    "companyId" | "title" | "category" | "amount" | "currency" | "date" | "status" | "billable" | "createdBy"
  > &
    Partial<Expense>
) {
  const ts = now();
  return addDoc(collection(db, path(workspaceId)), {
    ...input,
    workspaceId,
    createdAt: ts,
    updatedAt: ts,
  });
}

export async function updateExpense(workspaceId: string, expenseId: string, patch: Partial<Expense>) {
  // omitUndefined so `field: undefined` (clearing an optional value) never
  // hits updateDoc, which throws on any undefined field value.
  return updateDoc(
    doc(db, path(workspaceId), expenseId),
    omitUndefined({
      ...patch,
      updatedAt: now(),
    })
  );
}

export async function setExpenseStatus(workspaceId: string, expenseId: string, status: ExpenseStatus) {
  return updateExpense(workspaceId, expenseId, { status });
}

/** Deletes the expense and, best-effort, every attached receipt - a
 * Cloudinary hiccup shouldn't block someone from deleting the underlying
 * expense record. */
export async function deleteExpense(workspaceId: string, expenseId: string, receipts?: Expense["receipts"]) {
  await Promise.all(
    (receipts ?? []).map((r) => deleteCloudinaryAsset(r.publicId, r.resourceType).catch(() => {}))
  );
  return deleteDoc(doc(db, path(workspaceId), expenseId));
}

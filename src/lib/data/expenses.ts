"use client";

import {
  addDoc,
  collection,
  deleteField,
  doc,
  orderBy,
  updateDoc,
  where,
  deleteDoc,
  writeBatch,
} from "firebase/firestore";
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
    "companyId" | "title" | "category" | "amount" | "currency" | "date" | "status" | "createdBy"
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

/** Flips an expense's status and keeps the reimbursement audit trail
 * (reimbursedAt/reimbursedBy) in sync: stamped with `now()`/`memberId` when
 * moving to "reimbursed", cleared with deleteField() otherwise - bypasses
 * updateExpense/omitUndefined (which only ever *omits* undefined keys, never
 * clears a stored one) since reverting to "pending" needs the old
 * reimbursement date actually gone, not just unmentioned in this write. */
export async function setExpenseStatus(
  workspaceId: string,
  expenseId: string,
  status: ExpenseStatus,
  memberId?: string
) {
  const reimbursing = status === "reimbursed";
  return updateDoc(doc(db, path(workspaceId), expenseId), {
    status,
    updatedAt: now(),
    reimbursedAt: reimbursing ? now() : deleteField(),
    reimbursedBy: reimbursing && memberId ? memberId : deleteField(),
  });
}

/** Same as setExpenseStatus("reimbursed") but for many expenses in one
 * Firestore batch (a single payout covering several logged expenses),
 * chunked at 400 writes/batch (Firestore's limit is 500). */
export async function bulkMarkExpensesReimbursed(
  workspaceId: string,
  expenseIds: string[],
  memberId?: string
) {
  const ts = now();
  for (let i = 0; i < expenseIds.length; i += 400) {
    const batch = writeBatch(db);
    for (const id of expenseIds.slice(i, i + 400)) {
      batch.update(doc(db, path(workspaceId), id), {
        status: "reimbursed" satisfies ExpenseStatus,
        updatedAt: ts,
        reimbursedAt: ts,
        ...(memberId ? { reimbursedBy: memberId } : {}),
      });
    }
    await batch.commit();
  }
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

"use client";

import { addDoc, collection, doc, orderBy, updateDoc, where, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { Expense, ExpenseStatus } from "@/lib/types";
import { now } from "./firestore-helpers";
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
  input: Pick<Expense, "companyId" | "category" | "amount" | "currency" | "date" | "status" | "billable" | "createdBy"> &
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
  return updateDoc(doc(db, path(workspaceId), expenseId), {
    ...patch,
    updatedAt: now(),
  });
}

export async function setExpenseStatus(workspaceId: string, expenseId: string, status: ExpenseStatus) {
  return updateExpense(workspaceId, expenseId, { status });
}

export async function deleteExpense(workspaceId: string, expenseId: string) {
  return deleteDoc(doc(db, path(workspaceId), expenseId));
}

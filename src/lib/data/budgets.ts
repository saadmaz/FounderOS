"use client";

import { addDoc, collection, doc, orderBy, updateDoc, where, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { Budget } from "@/lib/types";
import { now } from "./firestore-helpers";
import { useCollection } from "./use-collection";

const path = (workspaceId: string) => `workspaces/${workspaceId}/budgets`;

export function useBudgets(workspaceId: string | null, companyId?: string) {
  const constraints = companyId
    ? [where("companyId", "==", companyId), orderBy("periodStart", "desc")]
    : [orderBy("periodStart", "desc")];
  return useCollection<Budget>(workspaceId ? path(workspaceId) : null, constraints, [
    workspaceId,
    companyId,
  ]);
}

export async function createBudget(
  workspaceId: string,
  input: Pick<Budget, "companyId" | "category" | "period" | "periodStart" | "allocatedAmount" | "currency"> &
    Partial<Budget>
) {
  const ts = now();
  return addDoc(collection(db, path(workspaceId)), {
    ...input,
    workspaceId,
    createdAt: ts,
    updatedAt: ts,
  });
}

export async function updateBudget(workspaceId: string, budgetId: string, patch: Partial<Budget>) {
  return updateDoc(doc(db, path(workspaceId), budgetId), {
    ...patch,
    updatedAt: now(),
  });
}

export async function deleteBudget(workspaceId: string, budgetId: string) {
  return deleteDoc(doc(db, path(workspaceId), budgetId));
}

/**
 * Given a budget's period, returns the [start, end) epoch millis range it
 * covers - used to sum matching expenses for "actual spend" comparisons.
 */
export function budgetPeriodRange(budget: Pick<Budget, "period" | "periodStart">): [number, number] {
  const start = new Date(budget.periodStart);
  const end = new Date(start);
  if (budget.period === "monthly") {
    end.setMonth(end.getMonth() + 1);
  } else if (budget.period === "quarterly") {
    end.setMonth(end.getMonth() + 3);
  } else {
    end.setFullYear(end.getFullYear() + 1);
  }
  return [start.getTime(), end.getTime()];
}

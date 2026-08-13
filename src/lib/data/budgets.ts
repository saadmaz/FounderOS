"use client";

import { addDoc, collection, doc, orderBy, updateDoc, where, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { Budget, Expense } from "@/lib/types";
import { now, omitUndefined } from "./firestore-helpers";
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
  return updateDoc(
    doc(db, path(workspaceId), budgetId),
    omitUndefined({
      ...patch,
      updatedAt: now(),
    })
  );
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

/**
 * A budget's actual spend for its own period: same company, category, and
 * *currency* (a budget has one currency; an expense logged in a different
 * one can't be added in without an exchange rate, so - like the overview
 * totals in finance/page.tsx - it's excluded rather than silently mixed
 * in) and within [periodStart, periodEnd). Shared by the Budgets tab
 * render and the over-budget check below so both agree on one definition.
 */
export function budgetActualSpend(
  budget: Pick<Budget, "companyId" | "category" | "currency" | "period" | "periodStart">,
  expenses: Expense[]
): number {
  const [start, end] = budgetPeriodRange(budget);
  return expenses
    .filter(
      (e) =>
        e.companyId === budget.companyId &&
        e.category === budget.category &&
        e.currency === budget.currency &&
        e.date >= start &&
        e.date < end
    )
    .reduce((sum, e) => sum + e.amount, 0);
}

/**
 * For every recurring budget whose most recent period has fully ended,
 * creates the budget(s) needed to have a period covering right now -
 * catches up in one pass even after a long gap (reopening after 3 months
 * creates the 3 missing monthly budgets, not just the next one). Only
 * recurring lineages roll forward; a one-off budget never grows extra
 * periods on its own. Idempotent (checks for an existing budget with the
 * same company+category+period+periodStart before creating), so it's safe
 * to call every time the Finance page loads.
 */
export async function rolloverRecurringBudgets(workspaceId: string, budgets: Budget[]) {
  const nowMs = now();
  // The *most recent* instance in each company+category+period lineage
  // decides whether it keeps rolling - regardless of the flag, so
  // unchecking "recurring" when editing the latest one actually stops it,
  // even if an older instance in the same lineage was created recurring.
  const latestByLineage = new Map<string, Budget>();
  for (const b of budgets) {
    const key = `${b.companyId}:${b.category}:${b.period}`;
    const current = latestByLineage.get(key);
    if (!current || b.periodStart > current.periodStart) latestByLineage.set(key, b);
  }
  const existingKeys = new Set(
    budgets.map((b) => `${b.companyId}:${b.category}:${b.period}:${b.periodStart}`)
  );
  for (const latest of latestByLineage.values()) {
    if (!latest.recurring) continue;
    let [, end] = budgetPeriodRange(latest);
    while (end <= nowMs) {
      const key = `${latest.companyId}:${latest.category}:${latest.period}:${end}`;
      if (!existingKeys.has(key)) {
        await createBudget(workspaceId, {
          companyId: latest.companyId,
          category: latest.category,
          period: latest.period,
          periodStart: end,
          allocatedAmount: latest.allocatedAmount,
          currency: latest.currency,
          recurring: true,
        });
        existingKeys.add(key);
      }
      [, end] = budgetPeriodRange({ period: latest.period, periodStart: end });
    }
  }
}

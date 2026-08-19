"use client";

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CircleCheck,
  Clock,
  Download,
  Landmark,
  MoreHorizontal,
  Paperclip,
  PiggyBank,
  Plus,
  Repeat,
  Search,
  Users,
  Wallet,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/shared/empty-state";
import { ScrollableTabStrip } from "@/components/shared/scrollable-tabs";
import { TableSkeleton } from "@/components/shared/table-skeleton";
import { StatCard } from "@/components/shared/stat-card";
import { BudgetFormDialog } from "@/components/finance/budget-form-dialog";
import { ExpenseFormDialog } from "@/components/finance/expense-form-dialog";
import { InvestmentFormDialog } from "@/components/finance/investment-form-dialog";
import { VendorFormDialog } from "@/components/finance/vendor-form-dialog";
import { useAuth } from "@/lib/auth/auth-provider";
import {
  budgetActualSpend,
  budgetPeriodRange,
  deleteBudget,
  rolloverRecurringBudgets,
  useBudgets,
} from "@/lib/data/budgets";
import { downloadCsv } from "@/lib/csv";
import { DATE_RANGE_PRESETS, dateRangePresetBounds, type DateRangePreset } from "@/lib/date-range";
import {
  bulkMarkExpensesReimbursed,
  deleteExpense,
  rolloverRecurringExpenses,
  setExpenseStatus,
  useExpenses,
} from "@/lib/data/expenses";
import { deleteInvestment, setInvestmentStatus, useInvestments } from "@/lib/data/investments";
import { useMembers } from "@/lib/data/members";
import { deleteVendor, useVendors } from "@/lib/data/vendors";
import { formatCurrency, formatDate, formatMixedCurrencyTotal } from "@/lib/format";
import { scrollMainToTop } from "@/lib/scroll";
import type {
  Budget,
  Company,
  Expense,
  ExpenseStatus,
  Investment,
  InvestmentStatus,
  Vendor,
  WorkspaceMember,
} from "@/lib/types";
import {
  BUDGET_PERIODS,
  EXPENSE_CATEGORIES,
  EXPENSE_STATUSES,
  INVESTMENT_STATUSES,
  INVESTMENT_TYPES,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/lib/workspace/workspace-provider";

const EXPENSE_STATUS_STYLES: Record<ExpenseStatus, string> = {
  pending: "bg-warning/10 text-warning",
  reimbursed: "bg-success/10 text-success",
};

function ExpenseStatusBadge({ status }: { status: ExpenseStatus }) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ring-current/15",
        EXPENSE_STATUS_STYLES[status]
      )}
    >
      <span className="size-1.5 shrink-0 rounded-full bg-current" />
      {EXPENSE_STATUSES.find((s) => s.value === status)?.label ?? status}
    </span>
  );
}

const DAY_MS = 86_400_000;

// `Date.now()` is read impurely in exactly this one place (mirrors the
// convention in meeting-card.tsx's meetingDateBucket) so ExpenseStatusHint
// below doesn't call it directly during render.
function daysSince(date: number, now = Date.now()): number {
  return Math.floor((now - date) / DAY_MS);
}

/** Whether a budget's *current* period (the one covering right now, not a
 * past or future one) is over its allocation - a budget that was over
 * budget three months ago shouldn't keep nagging forever. */
function isCurrentPeriodOverBudget(
  budget: Pick<Budget, "companyId" | "category" | "currency" | "period" | "periodStart" | "allocatedAmount">,
  expenses: Expense[],
  now = Date.now()
): boolean {
  const [start, end] = budgetPeriodRange(budget);
  if (now < start || now >= end) return false;
  return budgetActualSpend(budget, expenses) > budget.allocatedAmount;
}

/** Secondary text next to the status badge: how long a pending expense has
 * been waiting (colored once it's been a while, so aging reimbursements
 * are visible without opening each row), or when/by whom a reimbursed one
 * was actually paid back. */
function ExpenseStatusHint({
  expense,
  memberById,
}: {
  expense: Expense;
  memberById: Map<string, WorkspaceMember>;
}) {
  if (expense.status === "reimbursed") {
    if (!expense.reimbursedAt) return null;
    const by = expense.reimbursedBy ? memberById.get(expense.reimbursedBy)?.displayName : undefined;
    return (
      <span className="text-xs text-muted-foreground-2" title={by ? `Reimbursed by ${by}` : undefined}>
        {formatDate(expense.reimbursedAt)}
      </span>
    );
  }
  const days = daysSince(expense.date);
  if (days <= 0) return null;
  return (
    <span
      className={cn(
        "text-xs tabular-nums",
        days >= 30 ? "text-danger" : days >= 14 ? "text-warning" : "text-muted-foreground-2"
      )}
      title={`Logged ${days} day${days === 1 ? "" : "s"} ago, still pending`}
    >
      {days}d
    </span>
  );
}

type ExpenseSortState = { key: "date" | "amount"; dir: "asc" | "desc" } | null;

/** Clickable column header that toggles the Expenses table's sort: click
 * cycles unsorted -> desc -> asc -> unsorted (back to the underlying
 * Firestore date-desc order) for that column, switching to a fresh desc
 * sort if a different column is clicked while one is active. */
function ExpenseSortHeader({
  label,
  sortKey,
  sort,
  onSort,
  align = "left",
}: {
  label: string;
  sortKey: "date" | "amount";
  sort: ExpenseSortState;
  onSort: (key: "date" | "amount") => void;
  align?: "left" | "right";
}) {
  const active = sort?.key === sortKey;
  const Icon = active ? (sort.dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground",
        align === "right" && "flex-row-reverse"
      )}
    >
      {label}
      <Icon className={cn("size-3", active && "text-foreground")} />
    </button>
  );
}

const INVESTMENT_STATUS_STYLES: Record<InvestmentStatus, string> = {
  active: "bg-primary/10 text-primary",
  exited: "bg-success/10 text-success",
  written_off: "bg-danger/10 text-danger",
};

function InvestmentStatusBadge({ status }: { status: InvestmentStatus }) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ring-current/15",
        INVESTMENT_STATUS_STYLES[status]
      )}
    >
      <span className="size-1.5 shrink-0 rounded-full bg-current" />
      {INVESTMENT_STATUSES.find((s) => s.value === status)?.label ?? status}
    </span>
  );
}

/**
 * Finance tab for a single company's detail page. Mirrors the workspace-wide
 * Finance page but pre-scoped to one company - no company picker, and every
 * dialog is seeded with `companies={[company]}` so it can't be pointed
 * elsewhere.
 */
export function CompanyFinancePanel({ company }: { company: Company }) {
  const { user } = useAuth();
  const { workspace, role } = useWorkspace();
  const workspaceId = workspace?.id ?? null;
  const canEdit = role === "owner" || role === "admin" || role === "accountant";
  const companies = useMemo(() => [company], [company]);

  const { data: expenses, loading: expensesLoading } = useExpenses(workspaceId, company.id);
  const { data: budgets, loading: budgetsLoading } = useBudgets(workspaceId, company.id);
  const { data: allVendors, loading: vendorsLoading } = useVendors(workspaceId);
  const vendors = useMemo(() => allVendors.filter((v) => v.companyId === company.id), [allVendors, company.id]);
  const { data: investments, loading: investmentsLoading } = useInvestments(workspaceId, company.id);
  const { data: members } = useMembers(workspaceId);

  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [vendorDialogOpen, setVendorDialogOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [investmentDialogOpen, setInvestmentDialogOpen] = useState(false);
  const [editingInvestment, setEditingInvestment] = useState<Investment | null>(null);
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<Set<string>>(new Set());

  // Expenses-tab-only findability controls - never touch the Overview
  // totals or the other tabs, only what's listed (and exportable/
  // selectable) in the Expenses table below.
  const [expenseSearch, setExpenseSearch] = useState("");
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState<string>("all");
  const [expenseStatusFilter, setExpenseStatusFilter] = useState<string>("all");
  const [expenseDateRange, setExpenseDateRange] = useState<DateRangePreset>("all");
  const [expenseSort, setExpenseSort] = useState<ExpenseSortState>(null);

  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const expenseFiltersActive =
    expenseSearch.trim() !== "" ||
    expenseCategoryFilter !== "all" ||
    expenseStatusFilter !== "all" ||
    expenseDateRange !== "all";
  const visibleExpenses = useMemo(() => {
    let list = expenses;
    if (expenseCategoryFilter !== "all") list = list.filter((e) => e.category === expenseCategoryFilter);
    if (expenseStatusFilter !== "all") list = list.filter((e) => e.status === expenseStatusFilter);
    const bounds = dateRangePresetBounds(expenseDateRange);
    if (bounds) list = list.filter((e) => e.date >= bounds[0] && e.date < bounds[1]);
    const q = expenseSearch.trim().toLowerCase();
    if (q) {
      list = list.filter((e) =>
        [e.title, e.description, e.vendor].some((f) => f?.toLowerCase().includes(q))
      );
    }
    if (expenseSort) {
      const { key, dir } = expenseSort;
      list = [...list].sort((a, b) => {
        const diff = key === "date" ? a.date - b.date : a.amount - b.amount;
        return dir === "asc" ? diff : -diff;
      });
    }
    return list;
  }, [expenses, expenseCategoryFilter, expenseStatusFilter, expenseDateRange, expenseSearch, expenseSort]);
  function toggleExpenseSort(key: "date" | "amount") {
    setExpenseSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: "desc" };
      return prev.dir === "desc" ? { key, dir: "asc" } : null;
    });
  }
  // Only pending rows in the currently visible (filtered/searched) set are
  // ever selectable (see the row checkbox below), so a stale id from a
  // filter change just quietly drops out here rather than needing an effect
  // to prune selectedExpenseIds on every filter change.
  const selectedPendingIds = useMemo(
    () =>
      visibleExpenses.filter((e) => e.status === "pending" && selectedExpenseIds.has(e.id)).map((e) => e.id),
    [visibleExpenses, selectedExpenseIds]
  );
  const selectablePendingIds = useMemo(
    () => visibleExpenses.filter((e) => e.status === "pending").map((e) => e.id),
    [visibleExpenses]
  );

  // An expense/investment can carry its own currency (not necessarily
  // company.currency) - formatMixedCurrencyTotal keeps every currency's
  // subtotal separately visible instead of silently adding incompatible
  // amounts into one misleading number (see its doc comment).
  const totalPutIn = useMemo(() => formatMixedCurrencyTotal(expenses), [expenses]);
  const totalReimbursed = useMemo(
    () => formatMixedCurrencyTotal(expenses.filter((e) => e.status === "reimbursed")),
    [expenses]
  );
  const pendingReimbursement = useMemo(
    () => formatMixedCurrencyTotal(expenses.filter((e) => e.status === "pending")),
    [expenses]
  );
  const totalInvested = useMemo(() => formatMixedCurrencyTotal(investments), [investments]);

  // Runs once per mount, not on every budgets/expenses refetch
  // (rolloverRecurringBudgets/rolloverRecurringExpenses are idempotent, so a
  // re-run would just be a wasted no-op check, not a bug - the ref guards
  // are purely to avoid that redundant work).
  const budgetRolloverRanRef = useRef(false);
  useEffect(() => {
    if (!workspaceId || !canEdit || budgetsLoading || budgetRolloverRanRef.current) return;
    budgetRolloverRanRef.current = true;
    rolloverRecurringBudgets(workspaceId, budgets).catch(() => {});
  }, [workspaceId, canEdit, budgetsLoading, budgets]);
  const expenseRolloverRanRef = useRef(false);
  useEffect(() => {
    if (!workspaceId || !canEdit || expensesLoading || expenseRolloverRanRef.current) return;
    expenseRolloverRanRef.current = true;
    rolloverRecurringExpenses(workspaceId, expenses).catch(() => {});
  }, [workspaceId, canEdit, expensesLoading, expenses]);

  // Proactive nudge for budgets already over allocation *this* period - the
  // in-tab "Over budget" badge only helps if you open the Budgets tab.
  // Fires once per mount (see budgetRolloverRanRef above for why a ref
  // guard instead of a dependency-driven re-check).
  const overBudgetToastRanRef = useRef(false);
  useEffect(() => {
    if (budgetsLoading || expensesLoading || overBudgetToastRanRef.current) return;
    overBudgetToastRanRef.current = true;
    const overBudgetNow = budgets.filter((b) => isCurrentPeriodOverBudget(b, expenses));
    if (overBudgetNow.length === 0) return;
    if (overBudgetNow.length === 1) {
      const categoryLabel = EXPENSE_CATEGORIES.find((c) => c.value === overBudgetNow[0].category)?.label ?? overBudgetNow[0].category;
      toast.warning(`${company.name}'s ${categoryLabel} budget is over allocation this period`);
    } else {
      toast.warning(`${overBudgetNow.length} of ${company.name}'s budgets are over allocation this period`);
    }
  }, [budgetsLoading, expensesLoading, budgets, expenses, company.name]);

  async function handleDeleteExpense(expense: Expense) {
    if (!workspaceId) return;
    await deleteExpense(workspaceId, expense.id, expense.receipts);
    toast.success("Expense deleted");
  }
  async function handleMarkReimbursed(expense: Expense) {
    if (!workspaceId) return;
    await setExpenseStatus(workspaceId, expense.id, "reimbursed", user?.uid);
    toast.success("Expense marked as reimbursed");
  }
  async function handleBulkMarkReimbursed() {
    if (!workspaceId || selectedPendingIds.length === 0) return;
    const count = selectedPendingIds.length;
    await bulkMarkExpensesReimbursed(workspaceId, selectedPendingIds, user?.uid);
    setSelectedExpenseIds(new Set());
    toast.success(`${count} expense${count === 1 ? "" : "s"} marked as reimbursed`);
  }
  function toggleSelectAllPending() {
    setSelectedExpenseIds((prev) => {
      const allSelected = selectablePendingIds.every((id) => prev.has(id));
      return allSelected ? new Set() : new Set(selectablePendingIds);
    });
  }
  function toggleExpenseSelected(id: string) {
    setSelectedExpenseIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function clearExpenseFilters() {
    setExpenseSearch("");
    setExpenseCategoryFilter("all");
    setExpenseStatusFilter("all");
    setExpenseDateRange("all");
  }
  /** Exports exactly what's currently listed - same search/category/status/
   * date-range/sort the table is showing, so what you export matches what
   * you were looking at. */
  function handleExportExpenses() {
    downloadCsv(
      `${company.name}-expenses-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Date", "Title", "Category", "Vendor", "Status", "Currency", "Amount", "Logged by", "Description"],
      visibleExpenses.map((e) => [
        new Date(e.date).toISOString().slice(0, 10),
        e.title,
        EXPENSE_CATEGORIES.find((c) => c.value === e.category)?.label ?? e.category,
        e.vendor ?? "",
        EXPENSE_STATUSES.find((s) => s.value === e.status)?.label ?? e.status,
        e.currency,
        e.amount,
        memberById.get(e.createdBy)?.displayName ?? "",
        e.description ?? "",
      ])
    );
  }
  async function handleDeleteBudget(id: string) {
    if (!workspaceId) return;
    await deleteBudget(workspaceId, id);
    toast.success("Budget deleted");
  }
  async function handleDeleteVendor(id: string) {
    if (!workspaceId) return;
    await deleteVendor(workspaceId, id);
    toast.success("Vendor deleted");
  }
  async function handleDeleteInvestment(investment: Investment) {
    if (!workspaceId) return;
    await deleteInvestment(workspaceId, investment.id, investment.documents);
    toast.success("Investment deleted");
  }
  async function handleMarkInvestmentStatus(id: string, status: "exited" | "written_off") {
    if (!workspaceId) return;
    await setInvestmentStatus(workspaceId, id, status);
    toast.success(status === "exited" ? "Marked as exited" : "Marked as written off");
  }

  return (
    <div className="min-w-0 flex-1 space-y-6 p-4 lg:p-6">
      <Tabs defaultValue="overview" onValueChange={scrollMainToTop}>
        <ScrollableTabStrip className="-mx-4 px-4 lg:mx-0 lg:px-0">
          <TabsList className="w-max sm:w-fit">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="expenses">Expenses</TabsTrigger>
            <TabsTrigger value="budgets">Budgets</TabsTrigger>
            <TabsTrigger value="investments">Investments</TabsTrigger>
            <TabsTrigger value="vendors">Vendors</TabsTrigger>
          </TabsList>
        </ScrollableTabStrip>

        {/* ---------------- Overview ---------------- */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              label="Total Put In"
              value={totalPutIn}
              icon={Wallet}
              accent="text-danger"
              accentBg="bg-danger/10"
              loading={expensesLoading}
            />
            <StatCard
              label="Pending Reimbursement"
              value={pendingReimbursement}
              icon={Clock}
              accent="text-warning"
              accentBg="bg-warning/10"
              loading={expensesLoading}
            />
            <StatCard
              label="Reimbursed"
              value={totalReimbursed}
              icon={CircleCheck}
              accent="text-success"
              accentBg="bg-success/10"
              loading={expensesLoading}
            />
            <StatCard
              label="Total Invested"
              value={totalInvested}
              icon={Landmark}
              accent="text-analytics-purple"
              accentBg="bg-analytics-purple/10"
              loading={investmentsLoading}
            />
          </div>
        </TabsContent>

        {/* ---------------- Expenses ---------------- */}
        <TabsContent value="expenses" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {canEdit && selectedPendingIds.length > 0 ? (
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium">{selectedPendingIds.length} selected</span>
                <Button size="sm" className="gap-1.5" onClick={handleBulkMarkReimbursed}>
                  <CircleCheck className="size-4" />
                  Mark reimbursed
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSelectedExpenseIds(new Set())}>
                  Cancel
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {expenseFiltersActive
                  ? `${visibleExpenses.length} of ${expenses.length} expense${expenses.length === 1 ? "" : "s"}`
                  : `${expenses.length} expense${expenses.length === 1 ? "" : "s"}`}
              </p>
            )}
            <div className="flex items-center gap-2">
              {expenses.length > 0 && (
                <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExportExpenses}>
                  <Download className="size-4" />
                  Export
                </Button>
              )}
              {canEdit && (
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    setEditingExpense(null);
                    setExpenseDialogOpen(true);
                  }}
                >
                  <Plus className="size-4" />
                  New expense
                </Button>
              )}
            </div>
          </div>

          {expenses.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-40 flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={expenseSearch}
                  onChange={(e) => setExpenseSearch(e.target.value)}
                  placeholder="Search title, description, vendor…"
                  className="pl-8"
                />
              </div>
              <Select value={expenseCategoryFilter} onValueChange={(v) => setExpenseCategoryFilter(v ?? "all")}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Category">
                    {(v: string) => (v === "all" ? "Category" : EXPENSE_CATEGORIES.find((c) => c.value === v)?.label ?? v)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {EXPENSE_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={expenseStatusFilter} onValueChange={(v) => setExpenseStatusFilter(v ?? "all")}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Status">
                    {(v: string) => (v === "all" ? "Status" : EXPENSE_STATUSES.find((s) => s.value === v)?.label ?? v)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {EXPENSE_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={expenseDateRange} onValueChange={(v) => setExpenseDateRange((v ?? "all") as DateRangePreset)}>
                <SelectTrigger className="w-32">
                  <SelectValue>
                    {(v: string) => DATE_RANGE_PRESETS.find((p) => p.value === v)?.label ?? v}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {DATE_RANGE_PRESETS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {expenseFiltersActive && (
                <Button variant="ghost" size="sm" onClick={clearExpenseFilters}>
                  Clear
                </Button>
              )}
            </div>
          )}

          {expensesLoading ? (
            <TableSkeleton />
          ) : expenses.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="No expenses yet"
              description={`Log money you put in on ${company.name}'s behalf to start tracking it.`}
            />
          ) : visibleExpenses.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No expenses match"
              description="Try a different search or clear the filters above."
            />
          ) : (
            <div className="overflow-hidden rounded-xl border border-border shadow-sm">
              <Table>
                <TableHeader className="bg-surface">
                  <TableRow className="hover:bg-transparent">
                    {canEdit && (
                      <TableHead className="w-8">
                        {selectablePendingIds.length > 0 && (
                          <Checkbox
                            checked={selectablePendingIds.every((id) => selectedExpenseIds.has(id))}
                            onCheckedChange={toggleSelectAllPending}
                            aria-label="Select all pending expenses"
                          />
                        )}
                      </TableHead>
                    )}
                    <TableHead className="hidden sm:table-cell">
                      <ExpenseSortHeader label="Date" sortKey="date" sort={expenseSort} onSort={toggleExpenseSort} />
                    </TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">Expense</TableHead>
                    <TableHead className="hidden text-xs font-medium text-muted-foreground lg:table-cell">Category</TableHead>
                    <TableHead className="hidden text-xs font-medium text-muted-foreground lg:table-cell">Vendor</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">Status</TableHead>
                    <TableHead className="text-right">
                      <ExpenseSortHeader label="Amount" sortKey="amount" sort={expenseSort} onSort={toggleExpenseSort} align="right" />
                    </TableHead>
                    {canEdit && <TableHead />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleExpenses.map((e) => (
                    <TableRow key={e.id} className="hover:bg-secondary/40">
                      {canEdit && (
                        <TableCell className="py-2">
                          {e.status === "pending" && (
                            <Checkbox
                              checked={selectedExpenseIds.has(e.id)}
                              onCheckedChange={() => toggleExpenseSelected(e.id)}
                              aria-label={`Select ${e.title || "expense"}`}
                            />
                          )}
                        </TableCell>
                      )}
                      <TableCell className="hidden py-2 text-sm text-muted-foreground sm:table-cell">
                        {formatDate(e.date)}
                      </TableCell>
                      <TableCell className="max-w-36 py-2 sm:max-w-56">
                        <div className="flex items-center gap-1.5">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {e.title || e.description || "Untitled expense"}
                            </p>
                            <p className="truncate text-xs text-muted-foreground sm:hidden">
                              {formatDate(e.date)}
                            </p>
                            {e.description && e.title && (
                              <p className="hidden truncate text-xs text-muted-foreground sm:block">{e.description}</p>
                            )}
                            {/* Only shown for expenses someone else logged - in a
                                single-member workspace every row would say "Logged
                                by You", which is just noise. */}
                            {e.createdBy !== user?.uid && memberById.get(e.createdBy) && (
                              <p className="hidden truncate text-xs text-muted-foreground-2 lg:block">
                                Logged by {memberById.get(e.createdBy)?.displayName}
                              </p>
                            )}
                          </div>
                          {e.recurringInterval && (
                            <span
                              title={`Repeats every ${e.recurringInterval}`}
                              className="shrink-0 text-muted-foreground-2"
                            >
                              <Repeat className="size-3.5" />
                            </span>
                          )}
                          {e.receipts?.map((r) => (
                            <a
                              key={r.publicId}
                              href={r.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={`View receipt: ${r.name}`}
                              className="shrink-0 text-muted-foreground-2 hover:text-foreground"
                            >
                              <Paperclip className="size-3.5" />
                            </a>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="hidden py-2 text-sm capitalize text-muted-foreground lg:table-cell">
                        {EXPENSE_CATEGORIES.find((c) => c.value === e.category)?.label ?? e.category}
                      </TableCell>
                      <TableCell className="hidden py-2 text-sm text-muted-foreground lg:table-cell">
                        {e.vendor || "—"}
                      </TableCell>
                      <TableCell className="py-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <ExpenseStatusBadge status={e.status} />
                          <span className="hidden sm:inline">
                            <ExpenseStatusHint expense={e} memberById={memberById} />
                          </span>
                          {canEdit && e.status !== "reimbursed" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="hidden h-6 gap-1 px-2 text-xs sm:inline-flex"
                              onClick={() => handleMarkReimbursed(e)}
                            >
                              <CircleCheck className="size-3" />
                              Reimbursed
                            </Button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-2 text-right text-sm font-medium">
                        {formatCurrency(e.amount, e.currency)}
                      </TableCell>
                      {canEdit && (
                        <TableCell className="py-2 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={<Button variant="ghost" size="icon" className="size-7" aria-label="More actions" />}
                            >
                              <MoreHorizontal className="size-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {e.status !== "reimbursed" && (
                                <DropdownMenuItem
                                  className="sm:hidden"
                                  onClick={() => handleMarkReimbursed(e)}
                                >
                                  Mark reimbursed
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onClick={() => {
                                  setEditingExpense(e);
                                  setExpenseDialogOpen(true);
                                }}
                              >
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() => handleDeleteExpense(e)}
                              >
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* ---------------- Budgets ---------------- */}
        <TabsContent value="budgets" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {budgets.length} budget{budgets.length === 1 ? "" : "s"}
            </p>
            {canEdit && (
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  setEditingBudget(null);
                  setBudgetDialogOpen(true);
                }}
              >
                <Plus className="size-4" />
                New budget
              </Button>
            )}
          </div>

          {budgetsLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-36 animate-pulse rounded-xl bg-muted" />
              ))}
            </div>
          ) : budgets.length === 0 ? (
            <EmptyState
              icon={PiggyBank}
              title="No budgets set"
              description="Allocate what you're willing to put in per category and period, then track it against actual spend."
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {budgets.map((b) => {
                const actual = budgetActualSpend(b, expenses);
                const pct = b.allocatedAmount > 0 ? (actual / b.allocatedAmount) * 100 : 0;
                const overBudget = actual > b.allocatedAmount;

                return (
                  <div
                    key={b.id}
                    className={cn(
                      "relative rounded-xl border bg-card p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
                      overBudget ? "border-danger/30 bg-danger/[0.03] hover:border-danger/40" : "border-border hover:border-white/15"
                    )}
                  >
                    {canEdit && (
                      <div className="absolute right-3 top-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={<Button variant="ghost" size="icon" className="size-7" aria-label="More actions" />}
                          >
                            <MoreHorizontal className="size-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                setEditingBudget(b);
                                setBudgetDialogOpen(true);
                              }}
                            >
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => handleDeleteBudget(b.id)}
                            >
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )}
                    <div className="flex items-center gap-2 pr-8">
                      <span
                        className="rounded-full bg-secondary px-2 py-0.5 text-xs capitalize text-muted-foreground"
                      >
                        {EXPENSE_CATEGORIES.find((c) => c.value === b.category)?.label ?? b.category}
                      </span>
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-xs capitalize text-muted-foreground">
                        {BUDGET_PERIODS.find((p) => p.value === b.period)?.label ?? b.period}
                      </span>
                      {b.recurring && (
                        <span
                          className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground"
                          title="Automatically creates the next period's budget once this one ends"
                        >
                          <Repeat className="size-3" />
                          Repeats
                        </span>
                      )}
                    </div>
                    <div className="mt-4 space-y-1.5">
                      <div className="flex items-baseline justify-between text-sm">
                        <span className={cn("font-semibold", overBudget && "text-danger")}>
                          {formatCurrency(actual, b.currency)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          of {formatCurrency(b.allocatedAmount, b.currency)}
                        </span>
                      </div>
                      <Progress
                        value={Math.min(pct, 100)}
                        indicatorClassName={overBudget ? "bg-danger" : undefined}
                      />
                      {overBudget && <p className="text-xs font-medium text-danger">Over budget</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ---------------- Investments ---------------- */}
        <TabsContent value="investments" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {investments.length} investment{investments.length === 1 ? "" : "s"} ·{" "}
              {totalInvested} invested
            </p>
            {canEdit && (
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  setEditingInvestment(null);
                  setInvestmentDialogOpen(true);
                }}
              >
                <Plus className="size-4" />
                New investment
              </Button>
            )}
          </div>

          {investmentsLoading ? (
            <TableSkeleton />
          ) : investments.length === 0 ? (
            <EmptyState
              icon={Landmark}
              title="No investments logged"
              description={`Track capital you've put into ${company.name}.`}
            />
          ) : (
            <div className="overflow-hidden rounded-xl border border-border shadow-sm">
              <Table>
                <TableHeader className="bg-surface">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="hidden text-xs font-medium text-muted-foreground sm:table-cell">Date</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">Investment</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">Status</TableHead>
                    <TableHead className="text-right text-xs font-medium text-muted-foreground">
                      Amount
                    </TableHead>
                    {canEdit && <TableHead />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {investments.map((inv) => (
                    <TableRow key={inv.id} className="hover:bg-secondary/40">
                      <TableCell className="hidden py-2 text-sm text-muted-foreground sm:table-cell">
                        {formatDate(inv.date)}
                      </TableCell>
                      <TableCell className="max-w-36 py-2 sm:max-w-56">
                        <div className="flex items-center gap-1.5">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{inv.description || "Untitled investment"}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              <span className="sm:hidden">{formatDate(inv.date)} · </span>
                              {INVESTMENT_TYPES.find((t) => t.value === inv.type)?.label ?? inv.type}
                            </p>
                          </div>
                          {inv.documents?.map((d) => (
                            <a
                              key={d.publicId}
                              href={d.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={`View document: ${d.name}`}
                              className="shrink-0 text-muted-foreground-2 hover:text-foreground"
                            >
                              <Paperclip className="size-3.5" />
                            </a>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="py-2">
                        <InvestmentStatusBadge status={inv.status} />
                      </TableCell>
                      <TableCell className="py-2 text-right text-sm font-medium">
                        {formatCurrency(inv.amount, inv.currency)}
                      </TableCell>
                      {canEdit && (
                        <TableCell className="py-2 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={<Button variant="ghost" size="icon" className="size-7" aria-label="More actions" />}
                            >
                              <MoreHorizontal className="size-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => {
                                  setEditingInvestment(inv);
                                  setInvestmentDialogOpen(true);
                                }}
                              >
                                Edit
                              </DropdownMenuItem>
                              {inv.status === "active" && (
                                <>
                                  <DropdownMenuItem onClick={() => handleMarkInvestmentStatus(inv.id, "exited")}>
                                    Mark exited
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleMarkInvestmentStatus(inv.id, "written_off")}>
                                    Mark written off
                                  </DropdownMenuItem>
                                </>
                              )}
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() => handleDeleteInvestment(inv)}
                              >
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* ---------------- Vendors ---------------- */}
        <TabsContent value="vendors" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {vendors.length} vendor{vendors.length === 1 ? "" : "s"}
            </p>
            {canEdit && (
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  setEditingVendor(null);
                  setVendorDialogOpen(true);
                }}
              >
                <Plus className="size-4" />
                New vendor
              </Button>
            )}
          </div>

          {vendorsLoading ? (
            <TableSkeleton />
          ) : vendors.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No vendors yet"
              description="Keep track of who you pay and how to reach them."
            />
          ) : (
            <div className="overflow-hidden rounded-xl border border-border shadow-sm">
              <Table>
                <TableHeader className="bg-surface">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs font-medium text-muted-foreground">Name</TableHead>
                    <TableHead className="hidden text-xs font-medium text-muted-foreground sm:table-cell">Category</TableHead>
                    <TableHead className="hidden text-xs font-medium text-muted-foreground md:table-cell">Email</TableHead>
                    <TableHead className="hidden text-xs font-medium text-muted-foreground lg:table-cell">Phone</TableHead>
                    <TableHead className="hidden text-xs font-medium text-muted-foreground lg:table-cell">Website</TableHead>
                    {canEdit && <TableHead />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vendors.map((v) => (
                    <TableRow key={v.id} className="hover:bg-secondary/40">
                      <TableCell className="max-w-36 py-2 text-sm font-medium sm:max-w-none">
                        <span className="block truncate">{v.name}</span>
                        {v.category && (
                          <p className="truncate text-xs font-normal text-muted-foreground sm:hidden">{v.category}</p>
                        )}
                      </TableCell>
                      <TableCell className="hidden py-2 text-sm text-muted-foreground sm:table-cell">
                        {v.category ?? "—"}
                      </TableCell>
                      <TableCell className="hidden py-2 text-sm text-muted-foreground md:table-cell">
                        {v.contactEmail ?? "—"}
                      </TableCell>
                      <TableCell className="hidden py-2 text-sm text-muted-foreground lg:table-cell">
                        {v.contactPhone ?? "—"}
                      </TableCell>
                      <TableCell className="hidden max-w-40 truncate py-2 text-sm text-muted-foreground lg:table-cell">
                        {v.website ?? "—"}
                      </TableCell>
                      {canEdit && (
                        <TableCell className="py-2 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={<Button variant="ghost" size="icon" className="size-7" aria-label="More actions" />}
                            >
                              <MoreHorizontal className="size-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => {
                                  setEditingVendor(v);
                                  setVendorDialogOpen(true);
                                }}
                              >
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() => handleDeleteVendor(v.id)}
                              >
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {workspace && user && canEdit && (
        <>
          <ExpenseFormDialog
            open={expenseDialogOpen}
            onOpenChange={setExpenseDialogOpen}
            workspaceId={workspace.id}
            memberId={user.uid}
            companies={companies}
            expense={editingExpense}
          />
          <BudgetFormDialog
            open={budgetDialogOpen}
            onOpenChange={setBudgetDialogOpen}
            workspaceId={workspace.id}
            companies={companies}
            budget={editingBudget}
          />
          <VendorFormDialog
            open={vendorDialogOpen}
            onOpenChange={setVendorDialogOpen}
            workspaceId={workspace.id}
            companies={companies}
            vendor={editingVendor}
          />
          <InvestmentFormDialog
            open={investmentDialogOpen}
            onOpenChange={setInvestmentDialogOpen}
            workspaceId={workspace.id}
            companies={companies}
            investment={editingInvestment}
          />
        </>
      )}
    </div>
  );
}

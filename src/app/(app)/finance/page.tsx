"use client";

import {
  CircleCheck,
  Clock,
  Landmark,
  MoreHorizontal,
  Paperclip,
  PiggyBank,
  Plus,
  Users,
  Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { TableSkeleton } from "@/components/shared/table-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { BudgetFormDialog } from "@/components/finance/budget-form-dialog";
import { ExpenseFormDialog } from "@/components/finance/expense-form-dialog";
import { InvestmentFormDialog } from "@/components/finance/investment-form-dialog";
import { VendorFormDialog } from "@/components/finance/vendor-form-dialog";
import { useAuth } from "@/lib/auth/auth-provider";
import { useCompanies } from "@/lib/data/companies";
import { budgetPeriodRange, deleteBudget, useBudgets } from "@/lib/data/budgets";
import { deleteExpense, useExpenses } from "@/lib/data/expenses";
import { deleteInvestment, useInvestments } from "@/lib/data/investments";
import { deleteVendor, useVendors } from "@/lib/data/vendors";
import { commonCurrency, formatCurrency, formatDate } from "@/lib/format";
import { scrollMainToTop } from "@/lib/scroll";
import type {
  Budget,
  Expense,
  ExpenseStatus,
  Investment,
  InvestmentStatus,
  Vendor,
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
import { toast } from "sonner";

const EXPENSE_STATUS_STYLES: Record<ExpenseStatus, string> = {
  pending: "bg-warning/10 text-warning",
  approved: "bg-primary/10 text-primary",
  reimbursed: "bg-success/10 text-success",
  rejected: "bg-danger/10 text-danger",
};

function ExpenseStatusBadge({ status }: { status: ExpenseStatus }) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium",
        EXPENSE_STATUS_STYLES[status]
      )}
    >
      {EXPENSE_STATUSES.find((s) => s.value === status)?.label ?? status}
    </span>
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
        "inline-flex w-fit items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium",
        INVESTMENT_STATUS_STYLES[status]
      )}
    >
      {INVESTMENT_STATUSES.find((s) => s.value === status)?.label ?? status}
    </span>
  );
}

export default function FinancePage() {
  const { user } = useAuth();
  const { workspace, role } = useWorkspace();
  const workspaceId = workspace?.id ?? null;
  const canEdit = role === "owner" || role === "admin" || role === "accountant";

  const { data: companies } = useCompanies(workspaceId);
  const { data: expenses, loading: expensesLoading } = useExpenses(workspaceId);
  const { data: budgets, loading: budgetsLoading } = useBudgets(workspaceId);
  const { data: vendors, loading: vendorsLoading } = useVendors(workspaceId);
  const { data: investments, loading: investmentsLoading } = useInvestments(workspaceId);

  const [companyFilter, setCompanyFilter] = useState<string>("all");

  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [vendorDialogOpen, setVendorDialogOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [investmentDialogOpen, setInvestmentDialogOpen] = useState(false);
  const [editingInvestment, setEditingInvestment] = useState<Investment | null>(null);

  const companyById = useMemo(() => new Map(companies.map((c) => [c.id, c])), [companies]);

  const filteredExpenses = useMemo(
    () => (companyFilter === "all" ? expenses : expenses.filter((i) => i.companyId === companyFilter)),
    [expenses, companyFilter]
  );
  const filteredBudgets = useMemo(
    () => (companyFilter === "all" ? budgets : budgets.filter((i) => i.companyId === companyFilter)),
    [budgets, companyFilter]
  );
  const filteredVendors = useMemo(
    () => (companyFilter === "all" ? vendors : vendors.filter((v) => v.companyId === companyFilter)),
    [vendors, companyFilter]
  );
  const filteredInvestments = useMemo(
    () =>
      companyFilter === "all" ? investments : investments.filter((i) => i.companyId === companyFilter),
    [investments, companyFilter]
  );

  // A single selected company has one unambiguous currency; "All companies"
  // only has one if every company here actually shares it - otherwise there's
  // no honest single currency to sum into, so the stat cards fall back to
  // the workspace default rather than mislabeling a mixed-currency total.
  const displayCurrency = useMemo(
    () =>
      companyFilter === "all" ? commonCurrency(companies) : companyById.get(companyFilter)?.currency ?? "LKR",
    [companyFilter, companies, companyById]
  );

  // Rejected expenses were never actually paid, so they shouldn't count as
  // spend - only the entry in the table (for the audit trail) stays.
  const totalPutIn = useMemo(
    () =>
      filteredExpenses.filter((e) => e.status !== "rejected").reduce((sum, e) => sum + e.amount, 0),
    [filteredExpenses]
  );
  const totalReimbursed = useMemo(
    () =>
      filteredExpenses.filter((e) => e.status === "reimbursed").reduce((sum, e) => sum + e.amount, 0),
    [filteredExpenses]
  );
  const pendingReimbursement = useMemo(
    () =>
      filteredExpenses
        .filter((e) => e.status === "pending" || e.status === "approved")
        .reduce((sum, e) => sum + e.amount, 0),
    [filteredExpenses]
  );
  const totalInvested = useMemo(
    () => filteredInvestments.reduce((sum, i) => sum + i.amount, 0),
    [filteredInvestments]
  );

  async function handleDeleteExpense(expense: Expense) {
    if (!workspaceId) return;
    await deleteExpense(workspaceId, expense.id, expense.receipts);
    toast.success("Expense deleted");
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
  async function handleDeleteInvestment(id: string) {
    if (!workspaceId) return;
    await deleteInvestment(workspaceId, id);
    toast.success("Investment deleted");
  }

  return (
    <>
      <PageHeader
        title="Finance"
        description="What you've put into each company - expenses, reimbursement status, investments, budgets, and vendors."
        actions={
          companies.length > 0 && (
            <Select value={companyFilter} onValueChange={(v) => setCompanyFilter(v ?? "all")}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="All companies">
                  {(v: string) =>
                    v === "all" ? "All companies" : companyById.get(v)?.name ?? "All companies"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All companies</SelectItem>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )
        }
      />

      <div className="flex-1 space-y-6 p-4 lg:p-6">
        <Tabs defaultValue="overview" onValueChange={scrollMainToTop}>
          <div className="-mx-4 overflow-x-auto px-4 scrollbar-thin lg:mx-0 lg:px-0">
            <TabsList className="w-max sm:w-fit">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="expenses">Expenses</TabsTrigger>
              <TabsTrigger value="budgets">Budgets</TabsTrigger>
              <TabsTrigger value="investments">Investments</TabsTrigger>
              <TabsTrigger value="vendors">Vendors</TabsTrigger>
            </TabsList>
          </div>

          {/* ---------------- Overview ---------------- */}
          <TabsContent value="overview" className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard
                label="Total Put In"
                value={formatCurrency(totalPutIn, displayCurrency)}
                icon={Wallet}
                accent="text-danger"
                accentBg="bg-danger/10"
                loading={expensesLoading}
              />
              <StatCard
                label="Pending Reimbursement"
                value={formatCurrency(pendingReimbursement, displayCurrency)}
                icon={Clock}
                accent="text-warning"
                accentBg="bg-warning/10"
                loading={expensesLoading}
              />
              <StatCard
                label="Reimbursed"
                value={formatCurrency(totalReimbursed, displayCurrency)}
                icon={CircleCheck}
                accent="text-success"
                accentBg="bg-success/10"
                loading={expensesLoading}
              />
              <StatCard
                label="Total Invested"
                value={formatCurrency(totalInvested, displayCurrency)}
                icon={Landmark}
                accent="text-analytics-purple"
                accentBg="bg-analytics-purple/10"
                loading={investmentsLoading}
              />
            </div>
          </TabsContent>

          {/* ---------------- Expenses ---------------- */}
          <TabsContent value="expenses" className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {filteredExpenses.length} expense{filteredExpenses.length === 1 ? "" : "s"}
              </p>
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

            {expensesLoading ? (
              <TableSkeleton />
            ) : filteredExpenses.length === 0 ? (
              <EmptyState
                icon={Wallet}
                title="No expenses yet"
                description="Log money you put in on a company's behalf to start tracking it."
              />
            ) : (
              <div className="overflow-hidden rounded-xl border border-border">
                <Table>
                  <TableHeader className="bg-surface">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="hidden text-xs font-medium text-muted-foreground sm:table-cell">Date</TableHead>
                      <TableHead className="hidden text-xs font-medium text-muted-foreground md:table-cell">Company</TableHead>
                      <TableHead className="text-xs font-medium text-muted-foreground">Expense</TableHead>
                      <TableHead className="hidden text-xs font-medium text-muted-foreground lg:table-cell">Category</TableHead>
                      <TableHead className="hidden text-xs font-medium text-muted-foreground lg:table-cell">Vendor</TableHead>
                      <TableHead className="text-xs font-medium text-muted-foreground">Status</TableHead>
                      <TableHead className="text-right text-xs font-medium text-muted-foreground">
                        Amount
                      </TableHead>
                      {canEdit && <TableHead />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredExpenses.map((e) => (
                      <TableRow key={e.id} className="hover:bg-secondary/40">
                        <TableCell className="hidden py-2 text-sm text-muted-foreground sm:table-cell">
                          {formatDate(e.date)}
                        </TableCell>
                        <TableCell className="hidden py-2 md:table-cell">
                          <div className="flex items-center gap-2">
                            <span
                              className="size-2 rounded-full"
                              style={{ backgroundColor: companyById.get(e.companyId)?.color ?? "#71717A" }}
                            />
                            <span className="text-sm">{companyById.get(e.companyId)?.name ?? "—"}</span>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-56 py-2">
                          <div className="flex items-center gap-1.5">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">
                                {e.title || e.description || "Untitled expense"}
                              </p>
                              <p className="truncate text-xs text-muted-foreground sm:hidden">
                                {formatDate(e.date)} · {companyById.get(e.companyId)?.name ?? "—"}
                              </p>
                              {e.description && e.title && (
                                <p className="hidden truncate text-xs text-muted-foreground sm:block">{e.description}</p>
                              )}
                            </div>
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
                          <ExpenseStatusBadge status={e.status} />
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
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {filteredBudgets.length} budget{filteredBudgets.length === 1 ? "" : "s"}
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
            ) : filteredBudgets.length === 0 ? (
              <EmptyState
                icon={PiggyBank}
                title="No budgets set"
                description="Allocate spend per category and period, then track it against actual expenses."
              />
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredBudgets.map((b) => {
                  const [start, end] = budgetPeriodRange(b);
                  const actual = expenses
                    .filter(
                      (e) =>
                        e.companyId === b.companyId &&
                        e.category === b.category &&
                        e.status !== "rejected" &&
                        e.date >= start &&
                        e.date < end
                    )
                    .reduce((sum, e) => sum + e.amount, 0);
                  const pct = b.allocatedAmount > 0 ? (actual / b.allocatedAmount) * 100 : 0;
                  const overBudget = actual > b.allocatedAmount;

                  return (
                    <div key={b.id} className="relative rounded-xl border border-border bg-card p-4">
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
                          className="size-2 rounded-full"
                          style={{ backgroundColor: companyById.get(b.companyId)?.color ?? "#71717A" }}
                        />
                        <p className="truncate text-sm font-medium">{companyById.get(b.companyId)?.name ?? "—"}</p>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs capitalize text-muted-foreground">
                          {EXPENSE_CATEGORIES.find((c) => c.value === b.category)?.label ?? b.category}
                        </span>
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs capitalize text-muted-foreground">
                          {BUDGET_PERIODS.find((p) => p.value === b.period)?.label ?? b.period}
                        </span>
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
                        <Progress value={Math.min(pct, 100)} />
                        {overBudget && <p className="text-xs text-danger">Over budget</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ---------------- Investments ---------------- */}
          <TabsContent value="investments" className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {filteredInvestments.length} investment{filteredInvestments.length === 1 ? "" : "s"} ·{" "}
                {formatCurrency(totalInvested, displayCurrency)} invested
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
            ) : filteredInvestments.length === 0 ? (
              <EmptyState
                icon={Landmark}
                title="No investments logged"
                description="Track capital put into companies and other assets, and what it's worth now."
              />
            ) : (
              <div className="overflow-hidden rounded-xl border border-border">
                <Table>
                  <TableHeader className="bg-surface">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="hidden text-xs font-medium text-muted-foreground sm:table-cell">Date</TableHead>
                      <TableHead className="hidden text-xs font-medium text-muted-foreground md:table-cell">Company</TableHead>
                      <TableHead className="text-xs font-medium text-muted-foreground">Type</TableHead>
                      <TableHead className="text-xs font-medium text-muted-foreground">Status</TableHead>
                      <TableHead className="hidden text-right text-xs font-medium text-muted-foreground sm:table-cell">
                        Current Value
                      </TableHead>
                      <TableHead className="text-right text-xs font-medium text-muted-foreground">
                        Amount
                      </TableHead>
                      {canEdit && <TableHead />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInvestments.map((inv) => {
                      const gain =
                        inv.currentValue !== undefined ? inv.currentValue - inv.amount : undefined;
                      return (
                        <TableRow key={inv.id} className="hover:bg-secondary/40">
                          <TableCell className="hidden py-2 text-sm text-muted-foreground sm:table-cell">
                            {formatDate(inv.date)}
                          </TableCell>
                          <TableCell className="hidden py-2 md:table-cell">
                            <div className="flex items-center gap-2">
                              <span
                                className="size-2 rounded-full"
                                style={{
                                  backgroundColor: companyById.get(inv.companyId)?.color ?? "#71717A",
                                }}
                              />
                              <span className="text-sm">
                                {companyById.get(inv.companyId)?.name ?? "—"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="py-2 text-sm text-muted-foreground">
                            {INVESTMENT_TYPES.find((t) => t.value === inv.type)?.label ?? inv.type}
                            <p className="text-xs text-muted-foreground-2 sm:hidden">
                              {formatDate(inv.date)} · {companyById.get(inv.companyId)?.name ?? "—"}
                            </p>
                          </TableCell>
                          <TableCell className="py-2">
                            <InvestmentStatusBadge status={inv.status} />
                          </TableCell>
                          <TableCell className="hidden py-2 text-right text-sm sm:table-cell">
                            {inv.currentValue !== undefined ? (
                              <span
                                className={cn(
                                  "font-medium",
                                  gain !== undefined && gain > 0 && "text-success",
                                  gain !== undefined && gain < 0 && "text-danger"
                                )}
                              >
                                {formatCurrency(inv.currentValue, inv.currency)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
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
                                  <DropdownMenuItem
                                    variant="destructive"
                                    onClick={() => handleDeleteInvestment(inv.id)}
                                  >
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          {/* ---------------- Vendors ---------------- */}
          <TabsContent value="vendors" className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {filteredVendors.length} vendor{filteredVendors.length === 1 ? "" : "s"}
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
            ) : filteredVendors.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No vendors yet"
                description="Keep track of who you pay and how to reach them."
              />
            ) : (
              <div className="overflow-hidden rounded-xl border border-border">
                <Table>
                  <TableHeader className="bg-surface">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs font-medium text-muted-foreground">Name</TableHead>
                      <TableHead className="hidden text-xs font-medium text-muted-foreground sm:table-cell">Company</TableHead>
                      <TableHead className="hidden text-xs font-medium text-muted-foreground sm:table-cell">Category</TableHead>
                      <TableHead className="hidden text-xs font-medium text-muted-foreground md:table-cell">Email</TableHead>
                      <TableHead className="hidden text-xs font-medium text-muted-foreground lg:table-cell">Phone</TableHead>
                      <TableHead className="hidden text-xs font-medium text-muted-foreground lg:table-cell">Website</TableHead>
                      {canEdit && <TableHead />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredVendors.map((v) => (
                      <TableRow key={v.id} className="hover:bg-secondary/40">
                        <TableCell className="max-w-36 py-2 text-sm font-medium sm:max-w-none">
                          <span className="block truncate">{v.name}</span>
                          <p className="truncate text-xs font-normal text-muted-foreground sm:hidden">
                            {companyById.get(v.companyId)?.name ?? "—"}
                            {v.category ? ` · ${v.category}` : ""}
                          </p>
                        </TableCell>
                        <TableCell className="hidden py-2 sm:table-cell">
                          <div className="flex items-center gap-2">
                            <span
                              className="size-2 rounded-full"
                              style={{ backgroundColor: companyById.get(v.companyId)?.color ?? "#71717A" }}
                            />
                            <span className="text-sm">{companyById.get(v.companyId)?.name ?? "—"}</span>
                          </div>
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
      </div>

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
    </>
  );
}

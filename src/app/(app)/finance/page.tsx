"use client";

import {
  DollarSign,
  FileText,
  MoreHorizontal,
  PiggyBank,
  Plus,
  TrendingDown,
  TrendingUp,
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
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { BudgetFormDialog } from "@/components/finance/budget-form-dialog";
import { ExpenseFormDialog } from "@/components/finance/expense-form-dialog";
import { InvoiceFormDialog } from "@/components/finance/invoice-form-dialog";
import { RevenueFormDialog } from "@/components/finance/revenue-form-dialog";
import { VendorFormDialog } from "@/components/finance/vendor-form-dialog";
import { useAuth } from "@/lib/auth/auth-provider";
import { useCompanies } from "@/lib/data/companies";
import { budgetPeriodRange, deleteBudget, useBudgets } from "@/lib/data/budgets";
import { deleteExpense, useExpenses } from "@/lib/data/expenses";
import { deleteInvoice, markInvoicePaid, useInvoices } from "@/lib/data/invoices";
import { deleteRevenueEntry, useRevenue } from "@/lib/data/revenue";
import { deleteVendor, useVendors } from "@/lib/data/vendors";
import { formatCurrency, formatDate } from "@/lib/format";
import type {
  Budget,
  Expense,
  ExpenseStatus,
  Invoice,
  InvoiceStatus,
  RevenueEntry,
  Vendor,
} from "@/lib/types";
import { BUDGET_PERIODS, EXPENSE_CATEGORIES, EXPENSE_STATUSES, INVOICE_STATUSES } from "@/lib/types";
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

const INVOICE_STATUS_STYLES: Record<InvoiceStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-primary/10 text-primary",
  paid: "bg-success/10 text-success",
  overdue: "bg-danger/10 text-danger",
  cancelled: "bg-muted text-muted-foreground-2 line-through",
};

function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium",
        INVOICE_STATUS_STYLES[status]
      )}
    >
      {INVOICE_STATUSES.find((s) => s.value === status)?.label ?? status}
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
  const { data: revenue, loading: revenueLoading } = useRevenue(workspaceId);
  const { data: invoices, loading: invoicesLoading } = useInvoices(workspaceId);
  const { data: budgets, loading: budgetsLoading } = useBudgets(workspaceId);
  const { data: vendors, loading: vendorsLoading } = useVendors(workspaceId);

  const [companyFilter, setCompanyFilter] = useState<string>("all");

  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [revenueDialogOpen, setRevenueDialogOpen] = useState(false);
  const [editingRevenue, setEditingRevenue] = useState<RevenueEntry | null>(null);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [vendorDialogOpen, setVendorDialogOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);

  const companyById = useMemo(() => new Map(companies.map((c) => [c.id, c])), [companies]);

  const filteredExpenses = useMemo(
    () => (companyFilter === "all" ? expenses : expenses.filter((i) => i.companyId === companyFilter)),
    [expenses, companyFilter]
  );
  const filteredRevenue = useMemo(
    () => (companyFilter === "all" ? revenue : revenue.filter((i) => i.companyId === companyFilter)),
    [revenue, companyFilter]
  );
  const filteredInvoices = useMemo(
    () => (companyFilter === "all" ? invoices : invoices.filter((i) => i.companyId === companyFilter)),
    [invoices, companyFilter]
  );
  const filteredBudgets = useMemo(
    () => (companyFilter === "all" ? budgets : budgets.filter((i) => i.companyId === companyFilter)),
    [budgets, companyFilter]
  );
  const filteredVendors = useMemo(
    () => (companyFilter === "all" ? vendors : vendors.filter((v) => v.companyId === companyFilter)),
    [vendors, companyFilter]
  );

  const totalRevenue = useMemo(
    () => filteredRevenue.reduce((sum, r) => sum + r.amount, 0),
    [filteredRevenue]
  );
  const totalExpenses = useMemo(
    () => filteredExpenses.reduce((sum, e) => sum + e.amount, 0),
    [filteredExpenses]
  );
  const net = totalRevenue - totalExpenses;
  const outstandingInvoices = useMemo(
    () =>
      filteredInvoices
        .filter((i) => i.status === "sent" || i.status === "overdue")
        .reduce((sum, i) => sum + i.amount, 0),
    [filteredInvoices]
  );

  async function handleDeleteExpense(id: string) {
    if (!workspaceId) return;
    await deleteExpense(workspaceId, id);
    toast.success("Expense deleted");
  }
  async function handleDeleteRevenue(id: string) {
    if (!workspaceId) return;
    await deleteRevenueEntry(workspaceId, id);
    toast.success("Revenue entry deleted");
  }
  async function handleDeleteInvoice(id: string) {
    if (!workspaceId) return;
    await deleteInvoice(workspaceId, id);
    toast.success("Invoice deleted");
  }
  async function handleMarkPaid(id: string) {
    if (!workspaceId) return;
    await markInvoicePaid(workspaceId, id);
    toast.success("Invoice marked as paid");
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

  return (
    <>
      <PageHeader
        title="Finance"
        description="Expenses, revenue, invoices, budgets, and vendors across every company."
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
        <Tabs defaultValue="overview">
          <TabsList className="w-full sm:w-fit">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="expenses">Expenses</TabsTrigger>
            <TabsTrigger value="revenue">Revenue</TabsTrigger>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
            <TabsTrigger value="budgets">Budgets</TabsTrigger>
            <TabsTrigger value="vendors">Vendors</TabsTrigger>
          </TabsList>

          {/* ---------------- Overview ---------------- */}
          <TabsContent value="overview" className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard
                label="Total Revenue"
                value={formatCurrency(totalRevenue)}
                icon={DollarSign}
                accent="text-success"
                accentBg="bg-success/10"
                loading={revenueLoading}
              />
              <StatCard
                label="Total Expenses"
                value={formatCurrency(totalExpenses)}
                icon={Wallet}
                accent="text-danger"
                accentBg="bg-danger/10"
                loading={expensesLoading}
              />
              <StatCard
                label="Net"
                value={formatCurrency(net)}
                icon={net >= 0 ? TrendingUp : TrendingDown}
                accent={net >= 0 ? "text-success" : "text-danger"}
                accentBg={net >= 0 ? "bg-success/10" : "bg-danger/10"}
                loading={revenueLoading || expensesLoading}
              />
              <StatCard
                label="Outstanding Invoices"
                value={formatCurrency(outstandingInvoices)}
                icon={FileText}
                accent="text-warning"
                accentBg="bg-warning/10"
                loading={invoicesLoading}
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
              <div className="h-64 animate-pulse rounded-xl bg-muted" />
            ) : filteredExpenses.length === 0 ? (
              <EmptyState
                icon={Wallet}
                title="No expenses yet"
                description="Track spend across every company as it happens."
              />
            ) : (
              <div className="overflow-hidden rounded-xl border border-border">
                <Table>
                  <TableHeader className="bg-surface">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs font-medium text-muted-foreground">Date</TableHead>
                      <TableHead className="text-xs font-medium text-muted-foreground">Company</TableHead>
                      <TableHead className="text-xs font-medium text-muted-foreground">Category</TableHead>
                      <TableHead className="text-xs font-medium text-muted-foreground">Description</TableHead>
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
                        <TableCell className="py-2 text-sm text-muted-foreground">
                          {formatDate(e.date)}
                        </TableCell>
                        <TableCell className="py-2">
                          <div className="flex items-center gap-2">
                            <span
                              className="size-2 rounded-full"
                              style={{ backgroundColor: companyById.get(e.companyId)?.color ?? "#71717A" }}
                            />
                            <span className="text-sm">{companyById.get(e.companyId)?.name ?? "—"}</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-2 text-sm capitalize text-muted-foreground">
                          {EXPENSE_CATEGORIES.find((c) => c.value === e.category)?.label ?? e.category}
                        </TableCell>
                        <TableCell className="max-w-56 truncate py-2 text-sm text-muted-foreground">
                          {e.description ?? "—"}
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
                                render={<Button variant="ghost" size="icon" className="size-7" />}
                              >
                                <MoreHorizontal className="size-4" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onSelect={() => {
                                    setEditingExpense(e);
                                    setExpenseDialogOpen(true);
                                  }}
                                >
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  variant="destructive"
                                  onSelect={() => handleDeleteExpense(e.id)}
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

          {/* ---------------- Revenue ---------------- */}
          <TabsContent value="revenue" className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {filteredRevenue.length} entr{filteredRevenue.length === 1 ? "y" : "ies"}
              </p>
              {canEdit && (
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    setEditingRevenue(null);
                    setRevenueDialogOpen(true);
                  }}
                >
                  <Plus className="size-4" />
                  New revenue
                </Button>
              )}
            </div>

            {revenueLoading ? (
              <div className="h-64 animate-pulse rounded-xl bg-muted" />
            ) : filteredRevenue.length === 0 ? (
              <EmptyState
                icon={DollarSign}
                title="No revenue logged yet"
                description="Log income as it comes in to keep the P&L current."
              />
            ) : (
              <div className="overflow-hidden rounded-xl border border-border">
                <Table>
                  <TableHeader className="bg-surface">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs font-medium text-muted-foreground">Date</TableHead>
                      <TableHead className="text-xs font-medium text-muted-foreground">Company</TableHead>
                      <TableHead className="text-xs font-medium text-muted-foreground">Category</TableHead>
                      <TableHead className="text-xs font-medium text-muted-foreground">Source</TableHead>
                      <TableHead className="text-right text-xs font-medium text-muted-foreground">
                        Amount
                      </TableHead>
                      {canEdit && <TableHead />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRevenue.map((r) => (
                      <TableRow key={r.id} className="hover:bg-secondary/40">
                        <TableCell className="py-2 text-sm text-muted-foreground">
                          {formatDate(r.date)}
                        </TableCell>
                        <TableCell className="py-2">
                          <div className="flex items-center gap-2">
                            <span
                              className="size-2 rounded-full"
                              style={{ backgroundColor: companyById.get(r.companyId)?.color ?? "#71717A" }}
                            />
                            <span className="text-sm">{companyById.get(r.companyId)?.name ?? "—"}</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-2 text-sm capitalize text-muted-foreground">
                          {r.category}
                        </TableCell>
                        <TableCell className="py-2 text-sm text-muted-foreground">
                          {r.source ?? "—"}
                        </TableCell>
                        <TableCell className="py-2 text-right text-sm font-medium text-success">
                          {formatCurrency(r.amount, r.currency)}
                        </TableCell>
                        {canEdit && (
                          <TableCell className="py-2 text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                render={<Button variant="ghost" size="icon" className="size-7" />}
                              >
                                <MoreHorizontal className="size-4" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onSelect={() => {
                                    setEditingRevenue(r);
                                    setRevenueDialogOpen(true);
                                  }}
                                >
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  variant="destructive"
                                  onSelect={() => handleDeleteRevenue(r.id)}
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

          {/* ---------------- Invoices ---------------- */}
          <TabsContent value="invoices" className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {filteredInvoices.length} invoice{filteredInvoices.length === 1 ? "" : "s"}
              </p>
              {canEdit && (
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    setEditingInvoice(null);
                    setInvoiceDialogOpen(true);
                  }}
                >
                  <Plus className="size-4" />
                  New invoice
                </Button>
              )}
            </div>

            {invoicesLoading ? (
              <div className="h-64 animate-pulse rounded-xl bg-muted" />
            ) : filteredInvoices.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No invoices yet"
                description="Bill clients and track what's outstanding."
              />
            ) : (
              <div className="overflow-hidden rounded-xl border border-border">
                <Table>
                  <TableHeader className="bg-surface">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs font-medium text-muted-foreground">Invoice #</TableHead>
                      <TableHead className="text-xs font-medium text-muted-foreground">Client</TableHead>
                      <TableHead className="text-xs font-medium text-muted-foreground">Company</TableHead>
                      <TableHead className="text-xs font-medium text-muted-foreground">Status</TableHead>
                      <TableHead className="text-xs font-medium text-muted-foreground">Due</TableHead>
                      <TableHead className="text-right text-xs font-medium text-muted-foreground">
                        Amount
                      </TableHead>
                      {canEdit && <TableHead />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInvoices.map((inv) => (
                      <TableRow key={inv.id} className="hover:bg-secondary/40">
                        <TableCell className="py-2 text-sm font-medium">{inv.invoiceNumber}</TableCell>
                        <TableCell className="py-2 text-sm">{inv.clientName}</TableCell>
                        <TableCell className="py-2">
                          <div className="flex items-center gap-2">
                            <span
                              className="size-2 rounded-full"
                              style={{
                                backgroundColor: companyById.get(inv.companyId)?.color ?? "#71717A",
                              }}
                            />
                            <span className="text-sm">{companyById.get(inv.companyId)?.name ?? "—"}</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-2">
                          <InvoiceStatusBadge status={inv.status} />
                        </TableCell>
                        <TableCell className="py-2 text-sm text-muted-foreground">
                          {formatDate(inv.dueDate)}
                        </TableCell>
                        <TableCell className="py-2 text-right text-sm font-medium">
                          {formatCurrency(inv.amount, inv.currency)}
                        </TableCell>
                        {canEdit && (
                          <TableCell className="py-2 text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                render={<Button variant="ghost" size="icon" className="size-7" />}
                              >
                                <MoreHorizontal className="size-4" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onSelect={() => {
                                    setEditingInvoice(inv);
                                    setInvoiceDialogOpen(true);
                                  }}
                                >
                                  Edit
                                </DropdownMenuItem>
                                {inv.status !== "paid" && inv.status !== "cancelled" && (
                                  <DropdownMenuItem onSelect={() => handleMarkPaid(inv.id)}>
                                    Mark as paid
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  variant="destructive"
                                  onSelect={() => handleDeleteInvoice(inv.id)}
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
                              render={<Button variant="ghost" size="icon" className="size-7" />}
                            >
                              <MoreHorizontal className="size-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onSelect={() => {
                                  setEditingBudget(b);
                                  setBudgetDialogOpen(true);
                                }}
                              >
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                variant="destructive"
                                onSelect={() => handleDeleteBudget(b.id)}
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
              <div className="h-64 animate-pulse rounded-xl bg-muted" />
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
                      <TableHead className="text-xs font-medium text-muted-foreground">Company</TableHead>
                      <TableHead className="text-xs font-medium text-muted-foreground">Category</TableHead>
                      <TableHead className="text-xs font-medium text-muted-foreground">Email</TableHead>
                      <TableHead className="text-xs font-medium text-muted-foreground">Phone</TableHead>
                      <TableHead className="text-xs font-medium text-muted-foreground">Website</TableHead>
                      {canEdit && <TableHead />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredVendors.map((v) => (
                      <TableRow key={v.id} className="hover:bg-secondary/40">
                        <TableCell className="py-2 text-sm font-medium">{v.name}</TableCell>
                        <TableCell className="py-2">
                          <div className="flex items-center gap-2">
                            <span
                              className="size-2 rounded-full"
                              style={{ backgroundColor: companyById.get(v.companyId)?.color ?? "#71717A" }}
                            />
                            <span className="text-sm">{companyById.get(v.companyId)?.name ?? "—"}</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-2 text-sm text-muted-foreground">
                          {v.category ?? "—"}
                        </TableCell>
                        <TableCell className="py-2 text-sm text-muted-foreground">
                          {v.contactEmail ?? "—"}
                        </TableCell>
                        <TableCell className="py-2 text-sm text-muted-foreground">
                          {v.contactPhone ?? "—"}
                        </TableCell>
                        <TableCell className="max-w-40 truncate py-2 text-sm text-muted-foreground">
                          {v.website ?? "—"}
                        </TableCell>
                        {canEdit && (
                          <TableCell className="py-2 text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                render={<Button variant="ghost" size="icon" className="size-7" />}
                              >
                                <MoreHorizontal className="size-4" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onSelect={() => {
                                    setEditingVendor(v);
                                    setVendorDialogOpen(true);
                                  }}
                                >
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  variant="destructive"
                                  onSelect={() => handleDeleteVendor(v.id)}
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
          <RevenueFormDialog
            open={revenueDialogOpen}
            onOpenChange={setRevenueDialogOpen}
            workspaceId={workspace.id}
            companies={companies}
            entry={editingRevenue}
          />
          <InvoiceFormDialog
            open={invoiceDialogOpen}
            onOpenChange={setInvoiceDialogOpen}
            workspaceId={workspace.id}
            companies={companies}
            invoice={editingInvoice}
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
        </>
      )}
    </>
  );
}

"use client";

import {
  DollarSign,
  FileText,
  Landmark,
  MoreHorizontal,
  Paperclip,
  PiggyBank,
  Plus,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
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
import { StatCard } from "@/components/shared/stat-card";
import { BudgetFormDialog } from "@/components/finance/budget-form-dialog";
import { ExpenseFormDialog } from "@/components/finance/expense-form-dialog";
import { InvestmentFormDialog } from "@/components/finance/investment-form-dialog";
import { InvoiceFormDialog } from "@/components/finance/invoice-form-dialog";
import { RevenueFormDialog } from "@/components/finance/revenue-form-dialog";
import { VendorFormDialog } from "@/components/finance/vendor-form-dialog";
import { useAuth } from "@/lib/auth/auth-provider";
import { budgetPeriodRange, deleteBudget, useBudgets } from "@/lib/data/budgets";
import { deleteExpense, useExpenses } from "@/lib/data/expenses";
import { deleteInvestment, useInvestments } from "@/lib/data/investments";
import { deleteInvoice, markInvoicePaid, useInvoices } from "@/lib/data/invoices";
import { deleteRevenueEntry, useRevenue } from "@/lib/data/revenue";
import { deleteVendor, useVendors } from "@/lib/data/vendors";
import { formatCurrency, formatDate } from "@/lib/format";
import type {
  Budget,
  Company,
  Expense,
  ExpenseStatus,
  Invoice,
  InvoiceStatus,
  Investment,
  InvestmentStatus,
  RevenueEntry,
  Vendor,
} from "@/lib/types";
import {
  BUDGET_PERIODS,
  EXPENSE_CATEGORIES,
  EXPENSE_STATUSES,
  INVESTMENT_STATUSES,
  INVESTMENT_TYPES,
  INVOICE_STATUSES,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/lib/workspace/workspace-provider";

const EXPENSE_STATUS_STYLES: Record<ExpenseStatus, string> = {
  pending: "bg-warning/10 text-warning",
  approved: "bg-primary/10 text-primary",
  paid: "bg-analytics-cyan/10 text-analytics-cyan",
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
  const { data: revenue, loading: revenueLoading } = useRevenue(workspaceId, company.id);
  const { data: invoices, loading: invoicesLoading } = useInvoices(workspaceId, company.id);
  const { data: budgets, loading: budgetsLoading } = useBudgets(workspaceId, company.id);
  const { data: allVendors, loading: vendorsLoading } = useVendors(workspaceId);
  const vendors = useMemo(() => allVendors.filter((v) => v.companyId === company.id), [allVendors, company.id]);
  const { data: investments, loading: investmentsLoading } = useInvestments(workspaceId, company.id);

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
  const [investmentDialogOpen, setInvestmentDialogOpen] = useState(false);
  const [editingInvestment, setEditingInvestment] = useState<Investment | null>(null);

  const totalRevenue = useMemo(() => revenue.reduce((sum, r) => sum + r.amount, 0), [revenue]);
  // Rejected expenses were never actually paid, so they shouldn't count as spend.
  const totalExpenses = useMemo(
    () => expenses.filter((e) => e.status !== "rejected").reduce((sum, e) => sum + e.amount, 0),
    [expenses]
  );
  const net = totalRevenue - totalExpenses;
  const outstandingInvoices = useMemo(
    () =>
      invoices
        .filter((i) => i.status === "sent" || i.status === "overdue")
        .reduce((sum, i) => sum + i.amount, 0),
    [invoices]
  );
  const totalInvested = useMemo(() => investments.reduce((sum, i) => sum + i.amount, 0), [investments]);

  async function handleDeleteExpense(expense: Expense) {
    if (!workspaceId) return;
    await deleteExpense(workspaceId, expense.id, expense.receipt);
    toast.success("Expense deleted");
  }
  async function handleDeleteRevenue(id: string) {
    if (!workspaceId) return;
    await deleteRevenueEntry(workspaceId, id);
    toast.success("Revenue entry deleted");
  }
  async function handleDeleteInvoice(invoice: Invoice) {
    if (!workspaceId) return;
    await deleteInvoice(workspaceId, invoice.id, invoice.attachment);
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
  async function handleDeleteInvestment(id: string) {
    if (!workspaceId) return;
    await deleteInvestment(workspaceId, id);
    toast.success("Investment deleted");
  }

  return (
    <div className="flex-1 space-y-6 p-4 lg:p-6">
      <Tabs defaultValue="overview">
        <div className="-mx-4 overflow-x-auto px-4 scrollbar-thin lg:mx-0 lg:px-0">
          <TabsList className="w-max sm:w-fit">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="expenses">Expenses</TabsTrigger>
            <TabsTrigger value="revenue">Revenue</TabsTrigger>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
            <TabsTrigger value="budgets">Budgets</TabsTrigger>
            <TabsTrigger value="investments">Investments</TabsTrigger>
            <TabsTrigger value="vendors">Vendors</TabsTrigger>
          </TabsList>
        </div>

        {/* ---------------- Overview ---------------- */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
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
            <StatCard
              label="Total Invested"
              value={formatCurrency(totalInvested)}
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
              {expenses.length} expense{expenses.length === 1 ? "" : "s"}
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
          ) : expenses.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="No expenses yet"
              description={`Track spend for ${company.name} as it happens.`}
            />
          ) : (
            <div className="overflow-hidden rounded-xl border border-border">
              <Table>
                <TableHeader className="bg-surface">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs font-medium text-muted-foreground">Date</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">Category</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">Vendor</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">Description</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">Status</TableHead>
                    <TableHead className="text-right text-xs font-medium text-muted-foreground">
                      Amount
                    </TableHead>
                    {canEdit && <TableHead />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.map((e) => (
                    <TableRow key={e.id} className="hover:bg-secondary/40">
                      <TableCell className="py-2 text-sm text-muted-foreground">
                        {formatDate(e.date)}
                      </TableCell>
                      <TableCell className="py-2 text-sm capitalize text-muted-foreground">
                        {EXPENSE_CATEGORIES.find((c) => c.value === e.category)?.label ?? e.category}
                      </TableCell>
                      <TableCell className="py-2 text-sm text-muted-foreground">
                        {vendors.find((v) => v.id === e.vendorId)?.name ?? "—"}
                      </TableCell>
                      <TableCell className="max-w-56 py-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate">{e.description ?? "—"}</span>
                          {e.billable && (
                            <span
                              title="Billable to client"
                              className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary"
                            >
                              Billable
                            </span>
                          )}
                          {e.receipt && (
                            <a
                              href={e.receipt.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={`View receipt: ${e.receipt.name}`}
                              className="shrink-0 text-muted-foreground-2 hover:text-foreground"
                            >
                              <Paperclip className="size-3.5" />
                            </a>
                          )}
                        </div>
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

        {/* ---------------- Revenue ---------------- */}
        <TabsContent value="revenue" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {revenue.length} entr{revenue.length === 1 ? "y" : "ies"}
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
          ) : revenue.length === 0 ? (
            <EmptyState
              icon={DollarSign}
              title="No revenue logged yet"
              description={`Log income for ${company.name} to keep the P&L current.`}
            />
          ) : (
            <div className="overflow-hidden rounded-xl border border-border">
              <Table>
                <TableHeader className="bg-surface">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs font-medium text-muted-foreground">Date</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">Category</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">Source</TableHead>
                    <TableHead className="text-right text-xs font-medium text-muted-foreground">
                      Amount
                    </TableHead>
                    {canEdit && <TableHead />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {revenue.map((r) => (
                    <TableRow key={r.id} className="hover:bg-secondary/40">
                      <TableCell className="py-2 text-sm text-muted-foreground">
                        {formatDate(r.date)}
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
                                onClick={() => {
                                  setEditingRevenue(r);
                                  setRevenueDialogOpen(true);
                                }}
                              >
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() => handleDeleteRevenue(r.id)}
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
              {invoices.length} invoice{invoices.length === 1 ? "" : "s"}
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
          ) : invoices.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No invoices yet"
              description={`Bill ${company.name}'s clients and track what's outstanding.`}
            />
          ) : (
            <div className="overflow-hidden rounded-xl border border-border">
              <Table>
                <TableHeader className="bg-surface">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs font-medium text-muted-foreground">Invoice #</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">Client</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">Status</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">Due</TableHead>
                    <TableHead className="text-right text-xs font-medium text-muted-foreground">
                      Amount
                    </TableHead>
                    {canEdit && <TableHead />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((inv) => (
                    <TableRow key={inv.id} className="hover:bg-secondary/40">
                      <TableCell className="py-2 text-sm font-medium">
                        <div className="flex items-center gap-1.5">
                          <span>{inv.invoiceNumber}</span>
                          {inv.attachment && (
                            <a
                              href={inv.attachment.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={`View attachment: ${inv.attachment.name}`}
                              className="shrink-0 text-muted-foreground-2 hover:text-foreground"
                            >
                              <Paperclip className="size-3.5" />
                            </a>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-2 text-sm">{inv.clientName}</TableCell>
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
                                onClick={() => {
                                  setEditingInvoice(inv);
                                  setInvoiceDialogOpen(true);
                                }}
                              >
                                Edit
                              </DropdownMenuItem>
                              {inv.status !== "paid" && inv.status !== "cancelled" && (
                                <DropdownMenuItem onClick={() => handleMarkPaid(inv.id)}>
                                  Mark as paid
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() => handleDeleteInvoice(inv)}
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
              description="Allocate spend per category and period, then track it against actual expenses."
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {budgets.map((b) => {
                const [start, end] = budgetPeriodRange(b);
                const actual = expenses
                  .filter(
                    (e) =>
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
                            render={<Button variant="ghost" size="icon" className="size-7" />}
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
              {investments.length} investment{investments.length === 1 ? "" : "s"} ·{" "}
              {formatCurrency(totalInvested)} invested
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
            <div className="h-64 animate-pulse rounded-xl bg-muted" />
          ) : investments.length === 0 ? (
            <EmptyState
              icon={Landmark}
              title="No investments logged"
              description={`Track capital put into ${company.name} and what it's worth now.`}
            />
          ) : (
            <div className="overflow-hidden rounded-xl border border-border">
              <Table>
                <TableHeader className="bg-surface">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs font-medium text-muted-foreground">Date</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">Type</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">Status</TableHead>
                    <TableHead className="text-right text-xs font-medium text-muted-foreground">
                      Current Value
                    </TableHead>
                    <TableHead className="text-right text-xs font-medium text-muted-foreground">
                      Amount
                    </TableHead>
                    {canEdit && <TableHead />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {investments.map((inv) => {
                    const gain =
                      inv.currentValue !== undefined ? inv.currentValue - inv.amount : undefined;
                    return (
                      <TableRow key={inv.id} className="hover:bg-secondary/40">
                        <TableCell className="py-2 text-sm text-muted-foreground">
                          {formatDate(inv.date)}
                        </TableCell>
                        <TableCell className="py-2 text-sm text-muted-foreground">
                          {INVESTMENT_TYPES.find((t) => t.value === inv.type)?.label ?? inv.type}
                        </TableCell>
                        <TableCell className="py-2">
                          <InvestmentStatusBadge status={inv.status} />
                        </TableCell>
                        <TableCell className="py-2 text-right text-sm">
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
                                render={<Button variant="ghost" size="icon" className="size-7" />}
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
            <div className="h-64 animate-pulse rounded-xl bg-muted" />
          ) : vendors.length === 0 ? (
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
                    <TableHead className="text-xs font-medium text-muted-foreground">Category</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">Email</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">Phone</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">Website</TableHead>
                    {canEdit && <TableHead />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vendors.map((v) => (
                    <TableRow key={v.id} className="hover:bg-secondary/40">
                      <TableCell className="py-2 text-sm font-medium">{v.name}</TableCell>
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
            vendors={vendors}
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

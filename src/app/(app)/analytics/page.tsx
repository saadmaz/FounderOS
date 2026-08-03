"use client";

import { BarChart3, Building2, Clock, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { useCompanies } from "@/lib/data/companies";
import { useExpenses } from "@/lib/data/expenses";
import { useRevenue } from "@/lib/data/revenue";
import { useTasks } from "@/lib/data/tasks";
import { useTimeEntries } from "@/lib/data/time-entries";
import { formatCurrency, formatHours, sumHours } from "@/lib/format";
import type { TaskStatus } from "@/lib/types";
import { useWorkspace } from "@/lib/workspace/workspace-provider";

const TASK_STATUS_ORDER: TaskStatus[] = [
  "not_started",
  "in_progress",
  "in_review",
  "blocked",
  "completed",
  "cancelled",
];

// Same semantic mapping as status-badge.tsx (not imported directly - that
// component renders a pill, this needs raw color values for chart fills).
const TASK_STATUS_COLOR: Record<TaskStatus, string> = {
  not_started: "var(--muted-foreground-2)",
  in_progress: "var(--primary)",
  in_review: "var(--analytics-purple)",
  blocked: "var(--danger)",
  completed: "var(--success)",
  cancelled: "var(--muted-foreground-2)",
};

const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  in_review: "In Review",
  blocked: "Blocked",
  completed: "Completed",
  cancelled: "Cancelled",
};

function monthKey(ms: number) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string) {
  const [year, month] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "short" }).format(new Date(year, month - 1, 1));
}

function lastNMonthKeys(n: number) {
  const keys: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return keys;
}

const chartTooltipStyle = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  fontSize: "12px",
};

export default function AnalyticsPage() {
  const { workspace } = useWorkspace();
  const { data: companies, loading: companiesLoading } = useCompanies(workspace?.id ?? null);
  const { data: tasks, loading: tasksLoading } = useTasks(workspace?.id ?? null);
  const { data: timeEntries } = useTimeEntries(workspace?.id ?? null);
  const { data: revenue, loading: revenueLoading } = useRevenue(workspace?.id ?? null);
  const { data: expenses, loading: expensesLoading } = useExpenses(workspace?.id ?? null);

  const loading = companiesLoading || tasksLoading || revenueLoading || expensesLoading;

  const totalRevenue = useMemo(() => revenue.reduce((s, r) => s + r.amount, 0), [revenue]);
  const totalExpenses = useMemo(() => expenses.reduce((s, e) => s + e.amount, 0), [expenses]);
  const net = totalRevenue - totalExpenses;
  const totalHours = useMemo(() => sumHours(timeEntries), [timeEntries]);

  const monthlyTrend = useMemo(() => {
    const keys = lastNMonthKeys(6);
    const revByMonth = new Map<string, number>();
    for (const r of revenue) revByMonth.set(monthKey(r.date), (revByMonth.get(monthKey(r.date)) ?? 0) + r.amount);
    const expByMonth = new Map<string, number>();
    for (const e of expenses) expByMonth.set(monthKey(e.date), (expByMonth.get(monthKey(e.date)) ?? 0) + e.amount);
    return keys.map((k) => ({
      month: monthLabel(k),
      Revenue: Math.round(revByMonth.get(k) ?? 0),
      Expenses: Math.round(expByMonth.get(k) ?? 0),
    }));
  }, [revenue, expenses]);

  const hasFinanceData = revenue.length > 0 || expenses.length > 0;

  const companyHours = useMemo(() => {
    return companies
      .filter((c) => c.status !== "archived")
      .map((c) => ({
        name: c.name,
        hours: Math.round(sumHours(timeEntries.filter((e) => e.companyId === c.id)) * 10) / 10,
      }))
      .filter((c) => c.hours > 0)
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 8);
  }, [companies, timeEntries]);

  const companyRevenue = useMemo(() => {
    return companies
      .filter((c) => c.status !== "archived")
      .map((c) => ({
        name: c.name,
        revenue: revenue.filter((r) => r.companyId === c.id).reduce((s, r) => s + r.amount, 0),
      }))
      .filter((c) => c.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);
  }, [companies, revenue]);

  const taskStatusBreakdown = useMemo(() => {
    return TASK_STATUS_ORDER.map((status) => ({
      status,
      label: TASK_STATUS_LABEL[status],
      count: tasks.filter((t) => t.status === status).length,
      fill: TASK_STATUS_COLOR[status],
    })).filter((s) => s.count > 0);
  }, [tasks]);

  const hasAnyData = companies.length > 0 && (tasks.length > 0 || timeEntries.length > 0 || hasFinanceData);

  return (
    <>
      <PageHeader title="Analytics" description="Revenue, expenses, and activity across every company." />

      <div className="flex-1 space-y-6 p-4 lg:p-6">
        {!loading && !hasAnyData ? (
          <EmptyState
            icon={BarChart3}
            title="Nothing to analyze yet"
            description="Once you log time, revenue, expenses, or tasks, this page fills in with charts across all your companies."
          />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard
                label="Total Revenue"
                value={formatCurrency(totalRevenue)}
                icon={TrendingUp}
                accent="text-success"
                accentBg="bg-success/10"
                loading={loading}
              />
              <StatCard
                label="Total Expenses"
                value={formatCurrency(totalExpenses)}
                icon={TrendingDown}
                accent="text-danger"
                accentBg="bg-danger/10"
                loading={loading}
              />
              <StatCard
                label="Net"
                value={formatCurrency(net)}
                icon={Wallet}
                accent={net >= 0 ? "text-success" : "text-danger"}
                accentBg={net >= 0 ? "bg-success/10" : "bg-danger/10"}
                loading={loading}
              />
              <StatCard
                label="Hours Logged"
                value={formatHours(totalHours)}
                icon={Clock}
                accent="text-analytics-cyan"
                accentBg="bg-analytics-cyan/10"
                loading={loading}
              />
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <section className="rounded-xl border border-border bg-card p-5">
                <h2 className="text-sm font-semibold">Revenue vs Expenses</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">Last 6 months, across all companies</p>
                <div className="mt-4 h-64">
                  {hasFinanceData ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthlyTrend} barGap={4}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                        <XAxis
                          dataKey="month"
                          tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                          axisLine={{ stroke: "var(--border)" }}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                          axisLine={false}
                          tickLine={false}
                          width={44}
                        />
                        <Tooltip
                          contentStyle={chartTooltipStyle}
                          formatter={(value) => formatCurrency(Number(value))}
                        />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar dataKey="Revenue" fill="var(--success)" radius={[4, 4, 0, 0]} maxBarSize={28} />
                        <Bar dataKey="Expenses" fill="var(--danger)" radius={[4, 4, 0, 0]} maxBarSize={28} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                      No finance data logged yet.
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-xl border border-border bg-card p-5">
                <h2 className="text-sm font-semibold">Task Status</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">All tasks, across all companies</p>
                <div className="mt-4 h-64">
                  {taskStatusBreakdown.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={taskStatusBreakdown} layout="vertical" margin={{ left: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                        <XAxis
                          type="number"
                          tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                          axisLine={{ stroke: "var(--border)" }}
                          tickLine={false}
                          allowDecimals={false}
                        />
                        <YAxis
                          type="category"
                          dataKey="label"
                          tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                          axisLine={false}
                          tickLine={false}
                          width={80}
                        />
                        <Tooltip contentStyle={chartTooltipStyle} />
                        <Bar dataKey="count" name="Tasks" radius={[0, 4, 4, 0]} maxBarSize={20} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                      No tasks yet.
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-center gap-2">
                  <Building2 className="size-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold">Hours by Company</h2>
                </div>
                <div className="mt-4 h-64">
                  {companyHours.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={companyHours} layout="vertical" margin={{ left: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                        <XAxis
                          type="number"
                          tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                          axisLine={{ stroke: "var(--border)" }}
                          tickLine={false}
                        />
                        <YAxis
                          type="category"
                          dataKey="name"
                          tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                          axisLine={false}
                          tickLine={false}
                          width={90}
                        />
                        <Tooltip
                          contentStyle={chartTooltipStyle}
                          formatter={(value) => formatHours(Number(value))}
                        />
                        <Bar
                          dataKey="hours"
                          name="Hours"
                          fill="var(--analytics-cyan)"
                          radius={[0, 4, 4, 0]}
                          maxBarSize={20}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                      No time logged yet.
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-center gap-2">
                  <Wallet className="size-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold">Revenue by Company</h2>
                </div>
                <div className="mt-4 h-64">
                  {companyRevenue.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={companyRevenue} layout="vertical" margin={{ left: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                        <XAxis
                          type="number"
                          tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                          axisLine={{ stroke: "var(--border)" }}
                          tickLine={false}
                        />
                        <YAxis
                          type="category"
                          dataKey="name"
                          tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                          axisLine={false}
                          tickLine={false}
                          width={90}
                        />
                        <Tooltip
                          contentStyle={chartTooltipStyle}
                          formatter={(value) => formatCurrency(Number(value))}
                        />
                        <Bar
                          dataKey="revenue"
                          name="Revenue"
                          fill="var(--success)"
                          radius={[0, 4, 4, 0]}
                          maxBarSize={20}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                      No revenue logged yet.
                    </div>
                  )}
                </div>
              </section>
            </div>
          </>
        )}
      </div>
    </>
  );
}

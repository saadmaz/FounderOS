"use client";

import { formatDistanceToNow } from "date-fns";
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  CheckSquare,
  Clock,
  FolderKanban,
  Plus,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/shared/page-header";
import { PriorityBadge, StatusBadge } from "@/components/shared/status-badge";
import { StatCard } from "@/components/shared/stat-card";
import { CompanyFormDialog } from "@/components/companies/company-form-dialog";
import { OnboardingWelcome } from "@/components/companies/onboarding-welcome";
import { TaskFormDialog } from "@/components/tasks/task-form-dialog";
import { useAuth } from "@/lib/auth/auth-provider";
import { useCompanies } from "@/lib/data/companies";
import { useExpenses } from "@/lib/data/expenses";
import { useMeetings } from "@/lib/data/meetings";
import { useProjects } from "@/lib/data/projects";
import { useTasks } from "@/lib/data/tasks";
import { useTimeEntries } from "@/lib/data/time-entries";
import {
  DASHBOARD_PERIODS,
  dashboardPeriodBounds,
  type DashboardPeriod,
} from "@/lib/date-range";
import {
  formatDate,
  formatHours,
  formatMixedCurrencyTotal,
  sumHours,
  sumMeetingHours,
  sumTaskActualHours,
} from "@/lib/format";
import type { CompanyType } from "@/lib/types";
import { useWorkspace } from "@/lib/workspace/workspace-provider";
import { cn } from "@/lib/utils";

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

const DAY_MS = 86_400_000;

const shortDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

/** e.g. "Sep 1 – 30, 2026" for an [start, end) range. */
function formatRangeLabel([start, end]: [number, number]) {
  return shortDate.formatRange(new Date(start), new Date(end - 1));
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { workspace } = useWorkspace();
  const { data: companies, loading: companiesLoading } = useCompanies(workspace?.id ?? null);
  const { data: projects, loading: projectsLoading } = useProjects(workspace?.id ?? null);
  const { data: tasks, loading: tasksLoading } = useTasks(workspace?.id ?? null);
  const { data: timeEntries } = useTimeEntries(workspace?.id ?? null);
  const { data: meetings } = useMeetings(workspace?.id ?? null);
  const { data: expenses, loading: expensesLoading } = useExpenses(workspace?.id ?? null);
  const [period, setPeriod] = useState<DashboardPeriod>("this_week");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [companyDialogOpen, setCompanyDialogOpen] = useState(false);
  const [quickType, setQuickType] = useState<CompanyType>("startup");

  const today = startOfDay(new Date());
  const inSevenDays = today + 7 * DAY_MS;

  // Everything period-scoped below (hours, money spent, the trend chart,
  // company performance) reads from this one [start, end) window. Null while
  // a custom range is only half picked.
  const bounds = useMemo(
    () => dashboardPeriodBounds(period, { from: customFrom, to: customTo }),
    // `today` keeps "this week" rolling over at midnight on a long-open tab.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [period, customFrom, customTo, today]
  );

  const openTasks = useMemo(
    () => tasks.filter((t) => t.status !== "completed" && t.status !== "cancelled"),
    [tasks]
  );
  const overdue = useMemo(
    () => openTasks.filter((t) => t.dueDate && t.dueDate < today),
    [openTasks, today]
  );
  const dueToday = useMemo(
    () => openTasks.filter((t) => t.dueDate && t.dueDate >= today && t.dueDate < today + 86400000),
    [openTasks, today]
  );
  const upcoming = useMemo(
    () =>
      openTasks
        .filter((t) => t.dueDate && t.dueDate >= today + 86400000 && t.dueDate < inSevenDays)
        .sort((a, b) => (a.dueDate ?? 0) - (b.dueDate ?? 0))
        .slice(0, 5),
    [openTasks, today, inSevenDays]
  );
  const focusList = useMemo(
    () =>
      [...overdue, ...dueToday]
        .sort((a, b) => (a.dueDate ?? 0) - (b.dueDate ?? 0))
        .slice(0, 6),
    [overdue, dueToday]
  );
  const activeProjects = useMemo(
    () => projects.filter((p) => p.status !== "completed" && p.status !== "cancelled"),
    [projects]
  );
  // Hours in [from, to), optionally for one company: timer/manual entries,
  // completed meetings, plus time self-reported directly on a task (no
  // timer/manual entry, just estimatedMinutes + workDate - see
  // taskMinutesSpent) for tasks with zero entries of their own, so real
  // entries aren't double-counted.
  const hoursIn = useMemo(() => {
    const tasksWithEntries = new Set(timeEntries.map((e) => e.taskId).filter(Boolean));
    return (from: number, to: number, companyId?: string) => {
      const inCompany = (x: { companyId: string }) => !companyId || x.companyId === companyId;
      return (
        sumHours(timeEntries.filter((e) => inCompany(e) && e.startedAt >= from && e.startedAt < to)) +
        sumMeetingHours(meetings.filter((m) => inCompany(m) && m.scheduledAt >= from && m.scheduledAt < to)) +
        sumTaskActualHours(
          tasks.filter(
            (t) =>
              inCompany(t) && t.workDate && t.workDate >= from && t.workDate < to && !tasksWithEntries.has(t.id)
          ),
          timeEntries
        )
      );
    };
  }, [timeEntries, meetings, tasks]);

  const periodHours = useMemo(() => (bounds ? hoursIn(...bounds.range) : 0), [bounds, hoursIn]);
  // Only shown when there's a real prior period to compare against - a
  // fabricated "+100%" off a zero baseline would be exactly the kind of
  // misleading stat this is meant to replace (see: the old notification bell).
  const hoursDelta = useMemo(() => {
    if (!bounds) return undefined;
    const previous = hoursIn(...bounds.previous);
    if (previous <= 0) return undefined;
    const pct = Math.round(((periodHours - previous) / previous) * 100);
    if (pct === 0) return undefined;
    return { value: `${Math.abs(pct)}%`, positive: pct > 0 };
  }, [bounds, hoursIn, periodHours]);

  // Every expense counts as money spent, reimbursed or not. Expenses can
  // each carry their own currency, so this stays a per-currency sum
  // (formatMixedCurrencyTotal) rather than one misleading number.
  const periodExpenses = useMemo(
    () => (bounds ? expenses.filter((e) => e.date >= bounds.range[0] && e.date < bounds.range[1]) : []),
    [expenses, bounds]
  );
  const moneySpent = useMemo(() => formatMixedCurrencyTotal(periodExpenses), [periodExpenses]);

  // Hours trend across the selected period - one point per day for up to
  // ~2 months, one per month beyond that (a year of daily points is noise).
  const hoursTrend = useMemo(() => {
    if (!bounds) return [];
    const [from, to] = bounds.range;
    const points: { date: string; hours: number }[] = [];
    const daily = to - from <= 62 * DAY_MS;
    const label = new Intl.DateTimeFormat(
      "en-US",
      daily ? { month: "short", day: "numeric" } : { month: "short", year: "2-digit" }
    );
    const cursor = new Date(from);
    while (cursor.getTime() < to) {
      const bucketStart = cursor.getTime();
      if (daily) cursor.setDate(cursor.getDate() + 1);
      else cursor.setMonth(cursor.getMonth() + 1, 1);
      const bucketEnd = Math.min(cursor.getTime(), to);
      points.push({
        date: label.format(new Date(bucketStart)),
        hours: Math.round(hoursIn(bucketStart, bucketEnd) * 10) / 10,
      });
    }
    return points;
  }, [bounds, hoursIn]);
  const hasHoursHistory = hoursTrend.some((d) => d.hours > 0);

  const recentActivity = useMemo(
    () => [...tasks].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 6),
    [tasks]
  );

  const companyPerf = useMemo(() => {
    return companies
      .filter((c) => c.status === "active")
      .map((c) => {
        const hours = bounds ? hoursIn(bounds.range[0], bounds.range[1], c.id) : 0;
        const companyExpenses = periodExpenses.filter((e) => e.companyId === c.id);
        const spent = companyExpenses.length > 0 ? formatMixedCurrencyTotal(companyExpenses) : null;
        const open = tasks.filter(
          (t) => t.companyId === c.id && t.status !== "completed" && t.status !== "cancelled"
        ).length;
        return { company: c, hours, spent, open };
      })
      .sort((a, b) => b.hours - a.hours);
  }, [companies, tasks, bounds, hoursIn, periodExpenses]);

  const periodLabel = DASHBOARD_PERIODS.find((p) => p.value === period)?.label ?? "";

  const firstName = user?.displayName?.split(" ")[0];

  // A brand-new workspace has zero companies - the rest of this page is
  // widgets full of "No X yet" for something that doesn't exist yet, with
  // no obvious next step. Replace it with a direct question instead.
  if (!companiesLoading && companies.length === 0) {
    return (
      <>
        <PageHeader
          title={`${greeting()}${firstName ? `, ${firstName}` : ""}`}
          description="Let's get your first company set up."
        />
        <OnboardingWelcome
          displayName={user?.displayName}
          onPickType={(type) => {
            setQuickType(type);
            setCompanyDialogOpen(true);
          }}
        />
        <CompanyFormDialog
          open={companyDialogOpen}
          onOpenChange={setCompanyDialogOpen}
          defaultType={quickType}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={`${greeting()}${firstName ? `, ${firstName}` : ""}`}
        description={new Intl.DateTimeFormat("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        }).format(new Date())}
        actions={
          companies.length > 0 && (
            <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
              <Plus className="size-4" />
              New task
            </Button>
          )
        }
      />

      <div className="flex-1 space-y-6 p-4 lg:p-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard
            label="Active Companies"
            value={String(companies.filter((c) => c.status === "active").length)}
            icon={Building2}
            loading={companiesLoading}
          />
          <StatCard
            label="Active Projects"
            value={String(activeProjects.length)}
            icon={FolderKanban}
            accent="text-analytics-purple"
            accentBg="bg-analytics-purple/10"
            loading={projectsLoading}
          />
          <StatCard
            label="Open Tasks"
            value={String(openTasks.length)}
            icon={CheckSquare}
            accent="text-warning"
            accentBg="bg-warning/10"
            loading={tasksLoading}
          />
          <StatCard
            label="Due Today"
            value={String(dueToday.length)}
            icon={CalendarClock}
            accent="text-analytics-cyan"
            accentBg="bg-analytics-cyan/10"
            loading={tasksLoading}
          />
          <StatCard
            label="Overdue"
            value={String(overdue.length)}
            icon={AlertTriangle}
            accent="text-danger"
            accentBg="bg-danger/10"
            loading={tasksLoading}
          />
        </div>

        {/* Period-scoped stats - everything in this section, plus Company
         * Performance below, follows the period picked here. The task stats
         * above are "right now" figures and deliberately don't. */}
        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold">Time &amp; Spend</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {bounds ? formatRangeLabel(bounds.range) : "Pick a start and end date"}
              </p>
            </div>
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
              <Select value={period} onValueChange={(v) => setPeriod((v ?? "this_week") as DashboardPeriod)}>
                <SelectTrigger size="sm" className="w-full sm:w-40" aria-label="Period">
                  <SelectValue>{() => periodLabel}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {DASHBOARD_PERIODS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {period === "custom" && (
                <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
                  <DatePicker
                    value={customFrom}
                    onChange={setCustomFrom}
                    placeholder="From"
                    className="h-7 text-xs sm:w-36"
                  />
                  <DatePicker
                    value={customTo}
                    onChange={setCustomTo}
                    placeholder="To"
                    className="h-7 text-xs sm:w-36"
                    fromDate={customFrom ? new Date(`${customFrom}T00:00:00`) : undefined}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <StatCard
              label="Hours Spent"
              value={formatHours(periodHours)}
              icon={Clock}
              accent="text-analytics-pink"
              accentBg="bg-analytics-pink/10"
              delta={hoursDelta}
            />
            <StatCard
              label={`Money Spent · ${periodExpenses.length} expense${periodExpenses.length === 1 ? "" : "s"}`}
              value={moneySpent}
              icon={Wallet}
              accent="text-success"
              accentBg="bg-success/10"
              loading={expensesLoading}
            />
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-sm font-semibold">Hours Logged</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {periodLabel}, across all companies
            </p>
            <div className="mt-4 h-48">
              {hasHoursHistory ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={hoursTrend} margin={{ left: -20 }}>
                    <defs>
                      <linearGradient id="dashboardHoursGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--analytics-pink)" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="var(--analytics-pink)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                      axisLine={{ stroke: "var(--border)" }}
                      tickLine={false}
                      interval="preserveStartEnd"
                      minTickGap={16}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                      axisLine={false}
                      tickLine={false}
                      width={44}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                      formatter={(value) => [`${value}h`, "Hours"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="hours"
                      stroke="var(--analytics-pink)"
                      strokeWidth={2}
                      fill="url(#dashboardHoursGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
                  {bounds ? "No hours logged in this period." : "Pick a start and end date to see hours."}
                </div>
              )}
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            <section className="rounded-xl border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <h2 className="text-sm font-semibold">Today&apos;s Focus</h2>
                <Link href="/tasks" className="text-xs text-muted-foreground hover:text-foreground">
                  View all
                </Link>
              </div>
              {focusList.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Nothing overdue or due today. Nice.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {focusList.map((t) => {
                    const company = companies.find((c) => c.id === t.companyId);
                    const isOverdue = t.dueDate && t.dueDate < today;
                    return (
                      <li key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                        <span
                          className="size-2 shrink-0 rounded-full"
                          style={{ backgroundColor: company?.color ?? "#71717A" }}
                        />
                        <span className="flex-1 truncate text-sm">{t.title}</span>
                        <PriorityBadge priority={t.priority} />
                        <span
                          className={cn(
                            "w-16 shrink-0 text-right text-xs",
                            isOverdue ? "text-danger" : "text-muted-foreground"
                          )}
                        >
                          {isOverdue ? "Overdue" : "Today"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="rounded-xl border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <h2 className="text-sm font-semibold">Upcoming This Week</h2>
              </div>
              {upcoming.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Nothing on the calendar for the next 7 days.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {upcoming.map((t) => {
                    const company = companies.find((c) => c.id === t.companyId);
                    return (
                      <li key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                        <span
                          className="size-2 shrink-0 rounded-full"
                          style={{ backgroundColor: company?.color ?? "#71717A" }}
                        />
                        <span className="flex-1 truncate text-sm">{t.title}</span>
                        <StatusBadge status={t.status} />
                        <span className="w-24 shrink-0 text-right text-xs text-muted-foreground">
                          {t.dueDate && formatDate(t.dueDate)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>

          <div className="space-y-6">
            <section className="rounded-xl border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold">Company Performance</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">Hours &amp; spend · {periodLabel}</p>
                </div>
                <Link href="/companies" className="text-xs text-muted-foreground hover:text-foreground">
                  View all
                </Link>
              </div>
              {companyPerf.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No active companies yet.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {companyPerf.map(({ company, hours, spent, open }) => (
                    <li key={company.id}>
                      <Link
                        href={`/companies/${company.id}`}
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-secondary/50"
                      >
                        <Avatar size="sm" className="shrink-0 rounded-md">
                          <AvatarImage src={company.logoUrl} className="rounded-md" />
                          <AvatarFallback
                            className="rounded-md text-[11px] font-semibold text-white"
                            style={{ backgroundColor: company.color }}
                          >
                            {company.name[0]}
                          </AvatarFallback>
                        </Avatar>
                        <span className="flex-1 truncate text-sm font-medium">{company.name}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">{open} open</span>
                        <span className="flex max-w-[45%] shrink-0 flex-col items-end text-right">
                          <span className="text-xs font-medium">{formatHours(hours)}</span>
                          {spent && (
                            <span className="truncate text-[11px] text-muted-foreground" title={spent}>
                              {spent}
                            </span>
                          )}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-xl border border-border bg-card">
              <div className="border-b border-border px-4 py-3">
                <h2 className="text-sm font-semibold">Recent Activity</h2>
              </div>
              {recentActivity.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Activity will show up here as tasks move.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {recentActivity.map((t) => (
                    <li key={t.id} className="px-4 py-2.5">
                      <p className="truncate text-sm">{t.title}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <StatusBadge status={t.status} />
                        <span className="text-xs text-muted-foreground-2">
                          {formatDistanceToNow(t.updatedAt, { addSuffix: true })}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      </div>

      <TaskFormDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}

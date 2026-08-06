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
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { PriorityBadge, StatusBadge } from "@/components/shared/status-badge";
import { StatCard } from "@/components/shared/stat-card";
import { TaskFormDialog } from "@/components/tasks/task-form-dialog";
import { useAuth } from "@/lib/auth/auth-provider";
import { useCompanies } from "@/lib/data/companies";
import { useProjects } from "@/lib/data/projects";
import { useTasks } from "@/lib/data/tasks";
import { useTimeEntries } from "@/lib/data/time-entries";
import { formatHours, sumHours } from "@/lib/format";
import { useWorkspace } from "@/lib/workspace/workspace-provider";
import { cn } from "@/lib/utils";

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

function startOfWeek(d: Date) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // Monday = 0
  x.setDate(x.getDate() - day);
  return startOfDay(x);
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
  const [createOpen, setCreateOpen] = useState(false);

  const today = startOfDay(new Date());
  const weekStart = startOfWeek(new Date());
  const inSevenDays = today + 7 * 86400000;

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
  const hoursThisWeek = useMemo(
    () => sumHours(timeEntries.filter((e) => e.startedAt >= weekStart)),
    [timeEntries, weekStart]
  );

  const recentActivity = useMemo(
    () => [...tasks].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 6),
    [tasks]
  );

  const companyPerf = useMemo(() => {
    return companies
      .filter((c) => c.status === "active")
      .map((c) => {
        const hours = sumHours(timeEntries.filter((e) => e.companyId === c.id));
        const open = tasks.filter(
          (t) => t.companyId === c.id && t.status !== "completed" && t.status !== "cancelled"
        ).length;
        return { company: c, hours, open };
      })
      .sort((a, b) => b.hours - a.hours);
  }, [companies, timeEntries, tasks]);

  const firstName = user?.displayName?.split(" ")[0];

  return (
    <>
      <PageHeader
        title={`${greeting()}${firstName ? `, ${firstName}` : ""}`}
        description={new Intl.DateTimeFormat("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
        }).format(new Date())}
        actions={
          <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
            <Plus className="size-4" />
            New task
          </Button>
        }
      />

      <div className="flex-1 space-y-6 p-4 lg:p-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
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
          <StatCard
            label="Hours This Week"
            value={formatHours(hoursThisWeek)}
            icon={Clock}
            accent="text-analytics-pink"
            accentBg="bg-analytics-pink/10"
          />
        </div>

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
                        <span className="w-20 shrink-0 text-right text-xs text-muted-foreground">
                          {t.dueDate &&
                            new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(
                              t.dueDate
                            )}
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
                <h2 className="text-sm font-semibold">Company Performance</h2>
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
                  {companyPerf.map(({ company, hours, open }) => (
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
                        <span className="text-xs text-muted-foreground">{open} open</span>
                        <span className="w-12 shrink-0 text-right text-xs font-medium">
                          {formatHours(hours)}
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

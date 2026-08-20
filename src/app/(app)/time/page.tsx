"use client";

import { addWeeks, endOfWeek, format, isSameDay, startOfWeek, subWeeks } from "date-fns";
import { ChevronLeft, ChevronRight, Clock, DollarSign, Download, FolderKanban, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { TableSkeleton } from "@/components/shared/table-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { ManualEntryDialog } from "@/components/time/manual-entry-dialog";
import { TimerBar } from "@/components/time/timer-bar";
import { useAuth } from "@/lib/auth/auth-provider";
import { useCompanies } from "@/lib/data/companies";
import { useMembers } from "@/lib/data/members";
import { useProjects } from "@/lib/data/projects";
import { useTasks } from "@/lib/data/tasks";
import { deleteTimeEntry, findRunningEntry, useTimeEntries } from "@/lib/data/time-entries";
import { downloadCsv } from "@/lib/csv";
import { formatDateTime, formatHours, sumHours } from "@/lib/format";
import { useWorkspace } from "@/lib/workspace/workspace-provider";

const ALL_MEMBERS = "all";

export default function TimeTrackingPage() {
  const { user } = useAuth();
  const { workspace } = useWorkspace();
  const { data: companies } = useCompanies(workspace?.id ?? null);
  const { data: members } = useMembers(workspace?.id ?? null);
  const { data: projects } = useProjects(workspace?.id ?? null);
  const { data: tasks } = useTasks(workspace?.id ?? null);
  const { data: entries, loading } = useTimeEntries(workspace?.id ?? null);
  const [manualOpen, setManualOpen] = useState(false);
  const [tab, setTab] = useState<"log" | "byProject">("log");
  const [weekAnchor, setWeekAnchor] = useState(() => new Date());
  const [showAllTime, setShowAllTime] = useState(false);
  const [memberFilter, setMemberFilter] = useState(ALL_MEMBERS);

  const companyById = new Map(companies.map((c) => [c.id, c]));
  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const memberById = new Map(members.map((m) => [m.id, m]));
  const runningEntry = user ? findRunningEntry(entries, user.uid) : null;
  const completedEntries = useMemo(
    () => entries.filter((e) => e.endedAt !== null).sort((a, b) => b.startedAt - a.startedAt),
    [entries]
  );

  // Uses every entry (not just completedEntries) via the shared sumHours
  // helper, so a still-running timer counts toward these totals up to now -
  // matching the Dashboard/Analytics/Company pages, which all add a running
  // entry's elapsed time into their "hours" figures the same way.
  const totalHours = useMemo(() => sumHours(entries), [entries]);
  const billableHours = useMemo(
    () => sumHours(entries.filter((e) => e.billable)),
    [entries]
  );

  const weekStart = startOfWeek(weekAnchor, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(weekAnchor, { weekStartsOn: 1 });

  const memberFilteredEntries = useMemo(
    () =>
      memberFilter === ALL_MEMBERS
        ? completedEntries
        : completedEntries.filter((e) => e.memberId === memberFilter),
    [completedEntries, memberFilter]
  );

  const visibleEntries = useMemo(() => {
    if (showAllTime) return memberFilteredEntries;
    return memberFilteredEntries.filter((e) => e.startedAt >= weekStart.getTime() && e.startedAt <= weekEnd.getTime());
  }, [memberFilteredEntries, showAllTime, weekStart, weekEnd]);

  // Grouped by calendar day for the weekly view - each entry's own hours
  // (not sumHours, which would fold a still-running entry in; these are all
  // completedEntries already) via the same endedAt-startedAt calc the table
  // row itself uses.
  const dayGroups = useMemo(() => {
    if (showAllTime) return [];
    const days: Date[] = [];
    for (let d = new Date(weekStart); d <= weekEnd; d = new Date(d.getTime() + 86_400_000)) {
      days.push(d);
    }
    return days.map((day) => {
      const dayEntries = visibleEntries.filter((e) => isSameDay(e.startedAt, day));
      const hours = dayEntries.reduce((sum, e) => sum + (e.endedAt! - e.startedAt) / 3_600_000, 0);
      return { day, entries: dayEntries, hours };
    });
  }, [showAllTime, weekStart, weekEnd, visibleEntries]);

  const projectRollup = useMemo(() => {
    const groups = new Map<string, { hours: number; billableHours: number }>();
    for (const e of completedEntries) {
      const key = e.projectId ?? "none";
      const hours = (e.endedAt! - e.startedAt) / 3_600_000;
      const g = groups.get(key) ?? { hours: 0, billableHours: 0 };
      g.hours += hours;
      if (e.billable) g.billableHours += hours;
      groups.set(key, g);
    }
    return Array.from(groups.entries())
      .map(([projectId, totals]) => ({
        projectId,
        name: projectId === "none" ? "No project" : (projectById.get(projectId)?.name ?? "Unknown project"),
        ...totals,
      }))
      .sort((a, b) => b.hours - a.hours);
  }, [completedEntries, projectById]);

  function subjectFor(e: (typeof entries)[number]) {
    if (e.subjectLabel) return e.subjectLabel;
    if (e.taskId) return taskById.get(e.taskId)?.title ?? e.note ?? "—";
    if (e.note) return e.note;
    return "—";
  }

  function handleExportCsv() {
    downloadCsv(
      `time-entries-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Date", "Company", "Project", "Task", "Logged for", "Duration (hours)", "Billable", "Member", "Note"],
      visibleEntries.map((e) => [
        new Date(e.startedAt).toISOString().slice(0, 10),
        companyById.get(e.companyId)?.name ?? "",
        e.projectId ? (projectById.get(e.projectId)?.name ?? "") : "",
        e.taskId ? (taskById.get(e.taskId)?.title ?? "") : "",
        e.subjectLabel ?? "",
        Math.round(((e.endedAt! - e.startedAt) / 3_600_000) * 100) / 100,
        e.billable ? "Yes" : "No",
        memberById.get(e.memberId)?.displayName ?? "",
        e.note ?? "",
      ])
    );
  }

  return (
    <>
      <PageHeader
        title="Time Tracking"
        description="Every session, across every company."
        actions={
          <div className="flex items-center gap-2">
            {visibleEntries.length > 0 && (
              <Button variant="outline" onClick={handleExportCsv} className="gap-1.5">
                <Download className="size-4" />
                Export
              </Button>
            )}
            <Button variant="outline" onClick={() => setManualOpen(true)} className="gap-1.5">
              <Plus className="size-4" />
              Log time
            </Button>
          </div>
        }
      />

      <div className="flex-1 space-y-6 p-4 lg:p-6">
        {workspace && user && (
          <TimerBar
            workspaceId={workspace.id}
            memberId={user.uid}
            companies={companies}
            runningEntry={runningEntry}
          />
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
          <StatCard label="Total Hours Logged" value={formatHours(totalHours)} icon={Clock} />
          <StatCard
            label="Billable Hours"
            value={formatHours(billableHours)}
            icon={DollarSign}
            accent="text-success"
            accentBg="bg-success/10"
          />
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab((v as "log" | "byProject") ?? "log")}>
          <TabsList>
            <TabsTrigger value="log">Log</TabsTrigger>
            <TabsTrigger value="byProject">By Project</TabsTrigger>
          </TabsList>

          <TabsContent value="log" className="mt-4 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              {!showAllTime && (
                <div className="flex items-center gap-1 rounded-lg border border-border bg-surface p-0.5">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Previous week"
                    onClick={() => setWeekAnchor((d) => subWeeks(d, 1))}
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  <span className="px-2 text-xs font-medium">
                    {format(weekStart, "MMM d")} – {format(weekEnd, "MMM d")}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Next week"
                    onClick={() => setWeekAnchor((d) => addWeeks(d, 1))}
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              )}
              <Button variant="outline" size="sm" onClick={() => setShowAllTime((v) => !v)}>
                {showAllTime ? "View this week" : "View all time"}
              </Button>
              <Select value={memberFilter} onValueChange={(v) => setMemberFilter(v ?? ALL_MEMBERS)}>
                <SelectTrigger size="sm" className="w-40">
                  <SelectValue>
                    {(v: string) =>
                      v === ALL_MEMBERS ? "All members" : (memberById.get(v)?.displayName ?? "All members")
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_MEMBERS}>All members</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {loading ? (
              <TableSkeleton />
            ) : visibleEntries.length === 0 ? (
              <EmptyState
                icon={Clock}
                title="No time logged"
                description={
                  showAllTime
                    ? "Start the timer above, or log a session manually."
                    : "Nothing logged this week yet."
                }
              />
            ) : showAllTime ? (
              <TimeEntriesTable
                entries={visibleEntries}
                companyById={companyById}
                subjectFor={subjectFor}
                workspaceId={workspace!.id}
              />
            ) : (
              <div className="space-y-4">
                {dayGroups
                  .filter((g) => g.entries.length > 0)
                  .map((g) => (
                    <div key={g.day.toISOString()}>
                      <div className="mb-1.5 flex items-center justify-between px-1">
                        <h3 className="text-xs font-semibold text-muted-foreground">
                          {format(g.day, "EEEE, MMM d")}
                        </h3>
                        <span className="text-xs font-medium text-muted-foreground">{formatHours(g.hours)}</span>
                      </div>
                      <TimeEntriesTable
                        entries={g.entries}
                        companyById={companyById}
                        subjectFor={subjectFor}
                        workspaceId={workspace!.id}
                      />
                    </div>
                  ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="byProject" className="mt-4">
            {loading ? (
              <TableSkeleton />
            ) : projectRollup.length === 0 ? (
              <EmptyState icon={FolderKanban} title="No time logged" description="Project hours will roll up here once logged." />
            ) : (
              <div className="overflow-hidden rounded-xl border border-border">
                <Table>
                  <TableHeader className="bg-surface">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs font-medium text-muted-foreground">Project</TableHead>
                      <TableHead className="text-right text-xs font-medium text-muted-foreground">Hours</TableHead>
                      <TableHead className="text-right text-xs font-medium text-muted-foreground">Billable</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {projectRollup.map((row) => (
                      <TableRow key={row.projectId} className="hover:bg-secondary/40">
                        <TableCell className="py-2 text-sm">{row.name}</TableCell>
                        <TableCell className="py-2 text-right text-sm font-medium">
                          {formatHours(row.hours)}
                        </TableCell>
                        <TableCell className="py-2 text-right text-sm text-muted-foreground">
                          {formatHours(row.billableHours)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {workspace && user && (
        <ManualEntryDialog
          open={manualOpen}
          onOpenChange={setManualOpen}
          workspaceId={workspace.id}
          memberId={user.uid}
          companies={companies}
        />
      )}
    </>
  );
}

function TimeEntriesTable({
  entries,
  companyById,
  subjectFor,
  workspaceId,
}: {
  entries: ReturnType<typeof useTimeEntries>["data"];
  companyById: Map<string, { name: string; color: string }>;
  subjectFor: (e: ReturnType<typeof useTimeEntries>["data"][number]) => string;
  workspaceId: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <Table>
        <TableHeader className="bg-surface">
          <TableRow className="hover:bg-transparent">
            <TableHead className="text-xs font-medium text-muted-foreground">Logged for</TableHead>
            <TableHead className="hidden text-xs font-medium text-muted-foreground sm:table-cell">Company</TableHead>
            <TableHead className="hidden text-xs font-medium text-muted-foreground md:table-cell">Started</TableHead>
            <TableHead className="text-xs font-medium text-muted-foreground">Duration</TableHead>
            <TableHead className="hidden text-xs font-medium text-muted-foreground sm:table-cell">Billable</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((e) => {
            const company = companyById.get(e.companyId);
            const hours = (e.endedAt! - e.startedAt) / 3_600_000;
            return (
              <TableRow key={e.id} className="hover:bg-secondary/40">
                <TableCell className="max-w-40 py-2 sm:max-w-64">
                  <span className="block truncate text-sm">{subjectFor(e)}</span>
                  <p className="truncate text-xs text-muted-foreground sm:hidden">{company?.name ?? "—"}</p>
                </TableCell>
                <TableCell className="hidden py-2 sm:table-cell">
                  <div className="flex items-center gap-2">
                    <span
                      className="size-2 rounded-full"
                      style={{ backgroundColor: company?.color ?? "#71717A" }}
                    />
                    <span className="text-sm text-muted-foreground">{company?.name ?? "—"}</span>
                  </div>
                </TableCell>
                <TableCell className="hidden py-2 text-sm text-muted-foreground md:table-cell">
                  {formatDateTime(e.startedAt)}
                </TableCell>
                <TableCell className="py-2 text-sm font-medium">{formatHours(hours)}</TableCell>
                <TableCell className="hidden py-2 sm:table-cell">
                  <span className={`text-xs ${e.billable ? "text-success" : "text-muted-foreground-2"}`}>
                    {e.billable ? "Billable" : "Non-billable"}
                  </span>
                </TableCell>
                <TableCell className="py-2 text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground-2 hover:text-danger"
                    onClick={() => deleteTimeEntry(workspaceId, e.id)}
                    aria-label="Delete time entry"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

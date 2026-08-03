"use client";

import {
  Calendar as CalendarIcon,
  CheckSquare,
  Clock,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CALENDAR_EVENT_TYPE_LABELS,
  CALENDAR_EVENT_TYPE_STYLES,
  CalendarEventDialog,
} from "@/components/calendar/calendar-event-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { useAuth } from "@/lib/auth/auth-provider";
import { deleteCalendarEvent, useCalendarEvents } from "@/lib/data/calendar-events";
import { useCompanies } from "@/lib/data/companies";
import { useTasks } from "@/lib/data/tasks";
import { formatDate, formatDateTime } from "@/lib/format";
import type { CalendarEvent } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/lib/workspace/workspace-provider";

const DAY_MS = 86_400_000;

function startOfDay(ms: number) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function timeOf(ms: number) {
  return formatDateTime(ms).split(", ").pop();
}

export default function CalendarPage() {
  const { workspace } = useWorkspace();
  const { user } = useAuth();
  const { data: events, loading: eventsLoading } = useCalendarEvents(workspace?.id ?? null);
  const { data: tasks, loading: tasksLoading } = useTasks(workspace?.id ?? null);
  const { data: companies } = useCompanies(workspace?.id ?? null);

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<CalendarEvent | null>(null);

  const loading = eventsLoading || tasksLoading;
  const today = startOfDay(new Date().getTime());
  const selectedDayStart = startOfDay(selectedDate.getTime());

  const tasksWithDueDate = useMemo(() => tasks.filter((t) => t.dueDate != null), [tasks]);
  const hasAnyContent = events.length > 0 || tasksWithDueDate.length > 0;

  // ---- month grid dot indicators ----
  const { taskOnlyDays, eventOnlyDays, bothDays } = useMemo(() => {
    const taskDays = new Set(tasksWithDueDate.map((t) => startOfDay(t.dueDate as number)));
    const eventDays = new Set(events.map((e) => startOfDay(e.startsAt)));
    const taskOnly: Date[] = [];
    const eventOnly: Date[] = [];
    const both: Date[] = [];
    for (const d of taskDays) {
      (eventDays.has(d) ? both : taskOnly).push(new Date(d));
    }
    for (const d of eventDays) {
      if (!taskDays.has(d)) eventOnly.push(new Date(d));
    }
    return { taskOnlyDays: taskOnly, eventOnlyDays: eventOnly, bothDays: both };
  }, [tasksWithDueDate, events]);

  // ---- items for the selected day ----
  const selectedTasks = useMemo(
    () =>
      tasksWithDueDate
        .filter(
          (t) =>
            (t.dueDate as number) >= selectedDayStart &&
            (t.dueDate as number) < selectedDayStart + DAY_MS
        )
        .sort((a, b) => (a.dueDate as number) - (b.dueDate as number)),
    [tasksWithDueDate, selectedDayStart]
  );
  const selectedEvents = useMemo(
    () =>
      events
        .filter((e) => e.startsAt >= selectedDayStart && e.startsAt < selectedDayStart + DAY_MS)
        .sort((a, b) => a.startsAt - b.startsAt),
    [events, selectedDayStart]
  );

  // ---- next 7 days, merged and sorted ----
  const upcomingEnd = today + 7 * DAY_MS;
  const upcomingItems = useMemo(() => {
    const items: { key: string; kind: "event" | "task"; title: string; at: number }[] = [];
    for (const e of events) {
      if (e.startsAt >= today && e.startsAt < upcomingEnd) {
        items.push({ key: `e-${e.id}`, kind: "event", title: e.title, at: e.startsAt });
      }
    }
    for (const t of tasksWithDueDate) {
      const due = t.dueDate as number;
      if (due >= today && due < upcomingEnd) {
        items.push({ key: `t-${t.id}`, kind: "task", title: t.title, at: due });
      }
    }
    return items.sort((a, b) => a.at - b.at).slice(0, 10);
  }, [events, tasksWithDueDate, today, upcomingEnd]);

  function companyFor(companyId?: string) {
    return companyId ? companies.find((c) => c.id === companyId) : undefined;
  }

  async function handleDelete(event: CalendarEvent) {
    if (!workspace) return;
    if (!window.confirm(`Delete "${event.title}"? This can't be undone.`)) return;
    await deleteCalendarEvent(workspace.id, event.id);
    toast.success("Event deleted");
  }

  return (
    <>
      <PageHeader
        title="Calendar"
        description="Events, deadlines, and task due dates across every company."
        actions={
          <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
            <Plus className="size-4" />
            New event
          </Button>
        }
      />

      <div className="flex-1 p-4 lg:p-6">
        {loading ? (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <div className="h-112 animate-pulse rounded-xl bg-muted xl:col-span-2" />
            <div className="h-112 animate-pulse rounded-xl bg-muted" />
          </div>
        ) : !hasAnyContent ? (
          <EmptyState
            icon={CalendarIcon}
            title="Nothing on the calendar yet"
            description="Add an event, deadline, or reminder to start tracking dates across your companies."
            action={
              <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
                <Plus className="size-4" />
                New event
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <div className="space-y-6 xl:col-span-2">
              <section className="rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-1">
                  <h2 className="text-sm font-semibold">Month view</h2>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <span className="size-1.5 rounded-full bg-primary" /> Event
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="size-1.5 rounded-full bg-warning" /> Task due
                    </span>
                  </div>
                </div>
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(d) => d && setSelectedDate(d)}
                  modifiers={{ taskOnly: taskOnlyDays, eventOnly: eventOnlyDays, both: bothDays }}
                  modifiersClassNames={{
                    taskOnly:
                      "after:absolute after:bottom-1 after:left-1/2 after:size-1 after:-translate-x-1/2 after:rounded-full after:bg-warning after:content-['']",
                    eventOnly:
                      "after:absolute after:bottom-1 after:left-1/2 after:size-1 after:-translate-x-1/2 after:rounded-full after:bg-primary after:content-['']",
                    both: "before:absolute before:bottom-1 before:left-[calc(50%-4px)] before:size-1 before:rounded-full before:bg-warning before:content-[''] after:absolute after:bottom-1 after:left-[calc(50%+2px)] after:size-1 after:rounded-full after:bg-primary after:content-['']",
                  }}
                  className="mx-auto"
                />
              </section>

              <section className="rounded-xl border border-border bg-card">
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <h2 className="text-sm font-semibold">
                    {new Intl.DateTimeFormat("en-US", {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                    }).format(selectedDate)}
                  </h2>
                  {selectedDayStart === today && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      Today
                    </span>
                  )}
                </div>
                {selectedTasks.length === 0 && selectedEvents.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                    Nothing scheduled for this day.
                  </p>
                ) : (
                  <ul className="divide-y divide-border">
                    {selectedEvents.map((e) => {
                      const company = companyFor(e.companyId);
                      const canEdit = e.createdBy === user?.uid;
                      return (
                        <li key={e.id} className="flex items-center gap-3 px-4 py-2.5">
                          {company ? (
                            <span
                              className="size-2 shrink-0 rounded-full"
                              style={{ backgroundColor: company.color }}
                            />
                          ) : (
                            <span className="size-2 shrink-0 rounded-full bg-muted-foreground-2" />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm">{e.title}</p>
                            {e.notes && (
                              <p className="truncate text-xs text-muted-foreground">{e.notes}</p>
                            )}
                          </div>
                          <span
                            className={cn(
                              "inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium",
                              CALENDAR_EVENT_TYPE_STYLES[e.type]
                            )}
                          >
                            {CALENDAR_EVENT_TYPE_LABELS[e.type]}
                          </span>
                          <span className="w-16 shrink-0 text-right text-xs text-muted-foreground">
                            {e.allDay ? "All day" : timeOf(e.startsAt)}
                          </span>
                          {canEdit && (
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                render={
                                  <Button variant="ghost" size="icon" className="size-7 shrink-0" />
                                }
                              >
                                <MoreHorizontal className="size-4" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onSelect={() => setEditing(e)}>
                                  <Pencil className="size-4" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  variant="destructive"
                                  onSelect={() => handleDelete(e)}
                                >
                                  <Trash2 className="size-4" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </li>
                      );
                    })}
                    {selectedTasks.map((t) => {
                      const company = companyFor(t.companyId);
                      return (
                        <li key={t.id}>
                          <Link
                            href="/tasks"
                            className="flex items-center gap-3 px-4 py-2.5 hover:bg-secondary/50"
                          >
                            <span
                              className="size-2 shrink-0 rounded-full"
                              style={{ backgroundColor: company?.color ?? "#71717A" }}
                            />
                            <CheckSquare className="size-3.5 shrink-0 text-muted-foreground" />
                            <span className="min-w-0 flex-1 truncate text-sm">{t.title}</span>
                            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                              Task due
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </div>

            <div className="space-y-6">
              <section className="rounded-xl border border-border bg-card">
                <div className="border-b border-border px-4 py-3">
                  <h2 className="text-sm font-semibold">Upcoming (7 days)</h2>
                </div>
                {upcomingItems.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                    Nothing on the calendar for the next 7 days.
                  </p>
                ) : (
                  <ul className="divide-y divide-border">
                    {upcomingItems.map((item) =>
                      item.kind === "event" ? (
                        <li key={item.key} className="flex items-center gap-3 px-4 py-2.5">
                          <Clock className="size-3.5 shrink-0 text-primary" />
                          <span className="min-w-0 flex-1 truncate text-sm">{item.title}</span>
                          <span className="w-14 shrink-0 text-right text-xs text-muted-foreground">
                            {formatDate(item.at)}
                          </span>
                        </li>
                      ) : (
                        <li key={item.key}>
                          <Link
                            href="/tasks"
                            className="flex items-center gap-3 px-4 py-2.5 hover:bg-secondary/50"
                          >
                            <CheckSquare className="size-3.5 shrink-0 text-warning" />
                            <span className="min-w-0 flex-1 truncate text-sm">{item.title}</span>
                            <span className="w-14 shrink-0 text-right text-xs text-muted-foreground">
                              {formatDate(item.at)}
                            </span>
                          </Link>
                        </li>
                      )
                    )}
                  </ul>
                )}
              </section>
            </div>
          </div>
        )}
      </div>

      <CalendarEventDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultDate={selectedDate.getTime()}
      />
      <CalendarEventDialog
        open={Boolean(editing)}
        onOpenChange={(v) => !v && setEditing(null)}
        event={editing}
      />
    </>
  );
}

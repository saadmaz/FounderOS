"use client";

import {
  Calendar as CalendarIcon,
  CalendarClock,
  CalendarSync,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Clock,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { HourGrid } from "@/components/calendar/hour-grid";
import { MeetingFormDialog } from "@/components/meetings/meeting-form-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { useAuth } from "@/lib/auth/auth-provider";
import {
  addDays,
  buildCalendarItems,
  itemsForDay,
  startOfDay,
  startOfWeek,
  type CalendarItem,
} from "@/lib/calendar-items";
import {
  deleteCalendarEvent,
  deleteCalendarEventSeries,
  useCalendarEvents,
} from "@/lib/data/calendar-events";
import { useCompanies } from "@/lib/data/companies";
import { useMeetings } from "@/lib/data/meetings";
import { useTasks } from "@/lib/data/tasks";
import { formatDateTime } from "@/lib/format";
import { recurrenceSummary } from "@/lib/recurrence";
import type { CalendarEvent, Meeting } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/lib/workspace/workspace-provider";

const DAY_MS = 86_400_000;
const VIEW_MODES = ["month", "week", "day"] as const;
type ViewMode = (typeof VIEW_MODES)[number];

function timeOf(ms: number) {
  return formatDateTime(ms).split(", ").pop();
}

function weekDaysOf(anchor: Date): Date[] {
  const start = startOfWeek(anchor.getTime());
  return Array.from({ length: 7 }, (_, i) => new Date(addDays(start, i)));
}

export default function CalendarPage() {
  const { workspace } = useWorkspace();
  const { user } = useAuth();
  const router = useRouter();
  const { data: events, loading: eventsLoading } = useCalendarEvents(workspace?.id ?? null);
  const { data: meetings, loading: meetingsLoading } = useMeetings(workspace?.id ?? null);
  const { data: tasks, loading: tasksLoading } = useTasks(workspace?.id ?? null);
  const { data: companies } = useCompanies(workspace?.id ?? null);

  const [view, setView] = useState<ViewMode>("month");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [createEventOpen, setCreateEventOpen] = useState(false);
  const [createMeetingOpen, setCreateMeetingOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);

  const loading = eventsLoading || tasksLoading || meetingsLoading;
  // `new Date()` (not Date.now()) - matches the impure-read convention used
  // throughout this codebase (see src/lib/format.ts's sumHours).
  const today = startOfDay(new Date().getTime());
  const selectedDayStart = startOfDay(selectedDate.getTime());

  const items = useMemo(
    () => buildCalendarItems(events, meetings, tasks, companies),
    [events, meetings, tasks, companies]
  );
  const hasAnyContent = items.length > 0;

  // ---- month grid dot indicators - "something's scheduled" (event or
  // meeting) vs "task due", both if both. The day-detail list below gives
  // the real per-kind breakdown; the grid only needs to flag the day. ----
  const { taskOnlyDays, scheduledOnlyDays, bothDays } = useMemo(() => {
    const taskDays = new Set<number>();
    const scheduledDays = new Set<number>();
    for (const i of items) {
      (i.kind === "task" ? taskDays : scheduledDays).add(startOfDay(i.at));
    }
    const taskOnly: Date[] = [];
    const scheduledOnly: Date[] = [];
    const both: Date[] = [];
    for (const d of taskDays) (scheduledDays.has(d) ? both : taskOnly).push(new Date(d));
    for (const d of scheduledDays) if (!taskDays.has(d)) scheduledOnly.push(new Date(d));
    return { taskOnlyDays: taskOnly, scheduledOnlyDays: scheduledOnly, bothDays: both };
  }, [items]);

  const selectedDayItems = useMemo(
    () => itemsForDay(items, selectedDayStart),
    [items, selectedDayStart]
  );

  const upcomingEnd = today + 7 * DAY_MS;
  const upcomingItems = useMemo(
    () => items.filter((i) => i.at >= today && i.at < upcomingEnd).slice(0, 10),
    [items, today, upcomingEnd]
  );

  function companyFor(companyId?: string) {
    return companyId ? companies.find((c) => c.id === companyId) : undefined;
  }

  function handleItemClick(item: CalendarItem) {
    if (item.kind === "task") router.push("/tasks");
    else if (item.kind === "event") setEditingEvent(item.raw as CalendarEvent);
    else if (item.kind === "meeting") setEditingMeeting(item.raw as Meeting);
  }

  async function handleDelete(event: CalendarEvent) {
    if (!workspace) return;
    if (!window.confirm(`Delete "${event.title}"? This can't be undone.`)) return;
    await deleteCalendarEvent(workspace.id, event.id);
    toast.success("Event deleted");
  }

  async function handleDeleteSeries(event: CalendarEvent) {
    if (!workspace || !event.recurrence) return;
    if (
      !window.confirm(
        `Delete all ${event.recurrence.count} events in "${event.title}"'s series? This can't be undone.`
      )
    )
      return;
    await deleteCalendarEventSeries(workspace.id, event.recurrence.groupId);
    toast.success("Series deleted");
  }

  function goPrev() {
    if (view === "day") setSelectedDate(new Date(addDays(selectedDate.getTime(), -1)));
    else if (view === "week") setSelectedDate(new Date(addDays(selectedDate.getTime(), -7)));
    else setSelectedDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }
  function goNext() {
    if (view === "day") setSelectedDate(new Date(addDays(selectedDate.getTime(), 1)));
    else if (view === "week") setSelectedDate(new Date(addDays(selectedDate.getTime(), 7)));
    else setSelectedDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }
  function goToday() {
    setSelectedDate(new Date());
  }

  const headerLabel = useMemo(() => {
    if (view === "day") {
      return new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }).format(selectedDate);
    }
    if (view === "week") {
      const [start, end] = [weekDaysOf(selectedDate)[0], weekDaysOf(selectedDate)[6]];
      const sameMonth = start.getMonth() === end.getMonth();
      const startFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(start);
      const endFmt = new Intl.DateTimeFormat("en-US", {
        month: sameMonth ? undefined : "short",
        day: "numeric",
        year: "numeric",
      }).format(end);
      return `${startFmt} – ${endFmt}`;
    }
    return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(selectedDate);
  }, [view, selectedDate]);

  return (
    <>
      <PageHeader
        title="Calendar"
        description="Events, meetings, and task due dates across every company."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setCreateMeetingOpen(true)} className="gap-1.5">
              <Plus className="size-4" />
              New meeting
            </Button>
            <Button onClick={() => setCreateEventOpen(true)} className="gap-1.5">
              <Plus className="size-4" />
              New event
            </Button>
          </div>
        }
      />

      <div className="flex-1 space-y-4 p-4 lg:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="size-8" onClick={goPrev} aria-label="Previous">
              <ChevronLeft className="size-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={goToday}>
              Today
            </Button>
            <Button variant="outline" size="icon" className="size-8" onClick={goNext} aria-label="Next">
              <ChevronRight className="size-4" />
            </Button>
            <h2 className="ml-1 text-sm font-semibold">{headerLabel}</h2>
          </div>

          <div className="flex items-center gap-1 rounded-lg border border-border bg-surface p-0.5">
            {VIEW_MODES.map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors",
                  view === v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                )}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <div className="h-112 animate-pulse rounded-xl bg-muted xl:col-span-2" />
            <div className="h-112 animate-pulse rounded-xl bg-muted" />
          </div>
        ) : !hasAnyContent ? (
          <EmptyState
            icon={CalendarIcon}
            title="Nothing on the calendar yet"
            description="Add an event, deadline, reminder, or meeting to start tracking dates across your companies."
            action={
              <Button onClick={() => setCreateEventOpen(true)} className="gap-1.5">
                <Plus className="size-4" />
                New event
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <div className="space-y-6 xl:col-span-2">
              {view === "month" && (
                <>
                  <section className="rounded-xl border border-border bg-card p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
                      <h2 className="text-sm font-semibold">Month view</h2>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <span className="size-2 rounded-full bg-primary" /> Scheduled
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="size-2 rounded-full bg-warning" /> Task due
                        </span>
                      </div>
                    </div>
                    <Calendar
                      mode="single"
                      month={selectedDate}
                      onMonthChange={setSelectedDate}
                      selected={selectedDate}
                      onSelect={(d) => d && setSelectedDate(d)}
                      modifiers={{
                        taskOnly: taskOnlyDays,
                        eventOnly: scheduledOnlyDays,
                        both: bothDays,
                      }}
                      modifiersClassNames={{
                        taskOnly:
                          "after:absolute after:bottom-1.5 after:left-1/2 after:size-1.5 after:-translate-x-1/2 after:rounded-full after:bg-warning after:content-['']",
                        eventOnly:
                          "after:absolute after:bottom-1.5 after:left-1/2 after:size-1.5 after:-translate-x-1/2 after:rounded-full after:bg-primary after:content-['']",
                        both: "before:absolute before:bottom-1.5 before:left-[calc(50%-5px)] before:size-1.5 before:rounded-full before:bg-warning before:content-[''] after:absolute after:bottom-1.5 after:left-[calc(50%+3px)] after:size-1.5 after:rounded-full after:bg-primary after:content-['']",
                      }}
                      // The page's own Today/</> nav (above) already drives
                      // the visible month, so the grid's built-in caption +
                      // arrows would just be a second, redundant set of the
                      // same controls - hidden here. `root`/`month`/`months`
                      // go full-width so the grid actually fills this card
                      // instead of sitting tiny and centered in a sea of
                      // whitespace (each day column is an equal-width flex
                      // child, so this alone is what makes the cells bigger).
                      classNames={{
                        root: "w-full",
                        months: "w-full",
                        month: "w-full",
                        nav: "hidden",
                        month_caption: "hidden",
                        weekday: "flex-1 rounded-md pb-2 text-xs font-medium text-muted-foreground select-none",
                      }}
                      className="[--cell-size:--spacing(11)]"
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
                    {selectedDayItems.length === 0 ? (
                      <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                        Nothing scheduled for this day.
                      </p>
                    ) : (
                      <ul className="divide-y divide-border">
                        {selectedDayItems.map((item) => {
                          const company = companyFor(item.companyId);
                          if (item.kind === "event") {
                            const e = item.raw as CalendarEvent;
                            const canEdit = e.createdBy === user?.uid;
                            return (
                              <li key={item.id} className="flex items-center gap-3 px-4 py-2.5">
                                <span
                                  className="size-2 shrink-0 rounded-full"
                                  style={{ backgroundColor: company?.color ?? "#71717A" }}
                                />
                                <div className="min-w-0 flex-1">
                                  <p className="flex items-center gap-1.5 truncate text-sm">
                                    {e.recurrence && (
                                      <CalendarSync
                                        className="size-3 shrink-0 text-muted-foreground-2"
                                        aria-label={recurrenceSummary(
                                          e.recurrence.frequency,
                                          e.recurrence.interval
                                        )}
                                      />
                                    )}
                                    <span className="truncate">{e.title}</span>
                                  </p>
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
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="size-7 shrink-0"
                                          aria-label="Event actions"
                                        />
                                      }
                                    >
                                      <MoreHorizontal className="size-4" />
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem onClick={() => setEditingEvent(e)}>
                                        <Pencil className="size-4" />
                                        Edit
                                      </DropdownMenuItem>
                                      <DropdownMenuItem variant="destructive" onClick={() => handleDelete(e)}>
                                        <Trash2 className="size-4" />
                                        Delete{e.recurrence ? " this event" : ""}
                                      </DropdownMenuItem>
                                      {e.recurrence && (
                                        <DropdownMenuItem
                                          variant="destructive"
                                          onClick={() => handleDeleteSeries(e)}
                                        >
                                          <Trash2 className="size-4" />
                                          Delete entire series
                                        </DropdownMenuItem>
                                      )}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                )}
                              </li>
                            );
                          }
                          if (item.kind === "meeting") {
                            const m = item.raw as Meeting;
                            return (
                              <li key={item.id}>
                                <button
                                  type="button"
                                  onClick={() => setEditingMeeting(m)}
                                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-secondary/50"
                                >
                                  <span
                                    className="size-2 shrink-0 rounded-full"
                                    style={{ backgroundColor: company?.color ?? "#71717A" }}
                                  />
                                  <Users className="size-3.5 shrink-0 text-muted-foreground" />
                                  <div className="min-w-0 flex-1">
                                    <p className="flex items-center gap-1.5 truncate text-sm">
                                      {m.recurrence && (
                                        <CalendarSync className="size-3 shrink-0 text-muted-foreground-2" />
                                      )}
                                      <span className="truncate">{m.title}</span>
                                    </p>
                                  </div>
                                  <span className="shrink-0 rounded-full bg-analytics-purple/10 px-2 py-0.5 text-xs font-medium text-analytics-purple">
                                    Meeting
                                  </span>
                                  <span className="w-16 shrink-0 text-right text-xs text-muted-foreground">
                                    {timeOf(m.scheduledAt)}
                                  </span>
                                </button>
                              </li>
                            );
                          }
                          const t = item.raw;
                          return (
                            <li key={item.id}>
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
                </>
              )}

              {view === "week" && (
                <HourGrid days={weekDaysOf(selectedDate)} items={items} onItemClick={handleItemClick} />
              )}

              {view === "day" && (
                <HourGrid days={[selectedDate]} items={items} onItemClick={handleItemClick} />
              )}
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
                    {upcomingItems.map((item) => {
                      const Icon = item.kind === "meeting" ? CalendarClock : item.kind === "task" ? CheckSquare : Clock;
                      const content = (
                        <>
                          <Icon
                            className={cn(
                              "size-3.5 shrink-0",
                              item.kind === "task" ? "text-warning" : "text-primary"
                            )}
                          />
                          <span className="min-w-0 flex-1 truncate text-sm">{item.title}</span>
                          <span className="w-14 shrink-0 text-right text-xs text-muted-foreground">
                            {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(
                              item.at
                            )}
                          </span>
                        </>
                      );
                      return (
                        <li key={item.id}>
                          {item.kind === "task" ? (
                            <Link href="/tasks" className="flex items-center gap-3 px-4 py-2.5 hover:bg-secondary/50">
                              {content}
                            </Link>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleItemClick(item)}
                              className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-secondary/50"
                            >
                              {content}
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </div>
          </div>
        )}
      </div>

      <CalendarEventDialog
        open={createEventOpen}
        onOpenChange={setCreateEventOpen}
        defaultDate={selectedDate.getTime()}
      />
      <CalendarEventDialog
        open={Boolean(editingEvent)}
        onOpenChange={(v) => !v && setEditingEvent(null)}
        event={editingEvent}
      />
      <MeetingFormDialog open={createMeetingOpen} onOpenChange={setCreateMeetingOpen} />
      <MeetingFormDialog
        open={Boolean(editingMeeting)}
        onOpenChange={(v) => !v && setEditingMeeting(null)}
        meeting={editingMeeting}
      />
    </>
  );
}

import type { CalendarEvent, Company, Meeting, Recurrence, Task } from "./types";

export type CalendarItemKind = "event" | "meeting" | "task";

/**
 * A normalized shape the Calendar page's Month/Week/Day views all render
 * from - CalendarEvent, Meeting, and Task due dates each have a different
 * native shape, and none of the three collections know about the others.
 * Building this once here is what lets one calendar show everything that's
 * actually scheduled (see calendar/page.tsx) instead of just events.
 */
export interface CalendarItem {
  id: string;
  kind: CalendarItemKind;
  title: string;
  at: number; // start time
  endAt: number | null;
  allDay: boolean;
  companyId?: string;
  color: string; // resolved CSS color for this item's block/dot
  recurrence?: Recurrence;
  href?: string;
  raw: CalendarEvent | Meeting | Task;
}

const EVENT_TYPE_COLOR: Record<CalendarEvent["type"], string> = {
  event: "var(--primary)",
  deadline: "var(--danger)",
  reminder: "var(--warning)",
};

const TASK_COLOR = "var(--warning)";
const MEETING_FALLBACK_COLOR = "var(--analytics-purple)";

export function buildCalendarItems(
  events: CalendarEvent[],
  meetings: Meeting[],
  tasks: Task[],
  companies: Company[]
): CalendarItem[] {
  const companyById = new Map(companies.map((c) => [c.id, c]));
  const items: CalendarItem[] = [];

  for (const e of events) {
    // Archiving a company tucks its stuff out of the shared calendar view -
    // still on the company's own page, just not cluttering everyone else's.
    if (e.companyId && companyById.get(e.companyId)?.status === "archived") continue;
    items.push({
      id: `event-${e.id}`,
      kind: "event",
      title: e.title,
      at: e.startsAt,
      endAt: e.endsAt ?? null,
      allDay: e.allDay,
      companyId: e.companyId,
      color: e.companyId ? (companyById.get(e.companyId)?.color ?? EVENT_TYPE_COLOR[e.type]) : EVENT_TYPE_COLOR[e.type],
      recurrence: e.recurrence,
      raw: e,
    });
  }

  for (const m of meetings) {
    if (m.status === "cancelled") continue;
    if (companyById.get(m.companyId)?.status === "archived") continue;
    items.push({
      id: `meeting-${m.id}`,
      kind: "meeting",
      title: m.title,
      at: m.scheduledAt,
      endAt: m.scheduledAt + m.durationMinutes * 60_000,
      allDay: false,
      companyId: m.companyId,
      color: companyById.get(m.companyId)?.color ?? MEETING_FALLBACK_COLOR,
      recurrence: m.recurrence,
      raw: m,
    });
  }

  for (const t of tasks) {
    if (t.dueDate == null) continue;
    items.push({
      id: `task-${t.id}`,
      kind: "task",
      title: t.title,
      at: t.dueDate,
      endAt: null,
      allDay: true,
      companyId: t.companyId,
      color: TASK_COLOR,
      href: "/tasks",
      raw: t,
    });
  }

  return items.sort((a, b) => a.at - b.at);
}

export function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function addDays(ms: number, days: number): number {
  const d = new Date(ms);
  d.setDate(d.getDate() + days);
  return d.getTime();
}

/** Monday-start week containing `ms`. */
export function startOfWeek(ms: number): number {
  const d = new Date(startOfDay(ms));
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - day);
  return d.getTime();
}

export function itemsForDay(items: CalendarItem[], dayStart: number): CalendarItem[] {
  const dayEnd = addDays(dayStart, 1);
  return items.filter((i) => i.at < dayEnd && (i.endAt ?? i.at) >= dayStart);
}

export interface PositionedItem {
  item: CalendarItem;
  column: number;
  columnCount: number;
}

const DEFAULT_BLOCK_MS = 30 * 60_000;

/**
 * Greedy interval-graph column assignment for same-day timed items, so
 * overlapping meetings/events render side-by-side instead of stacked
 * illegibly on top of each other in the hour grid.
 */
export function layoutTimedItems(items: CalendarItem[]): PositionedItem[] {
  const timed = [...items]
    .filter((i) => !i.allDay)
    .sort((a, b) => a.at - b.at || (a.endAt ?? a.at) - (b.endAt ?? b.at));

  const active: { column: number; end: number }[] = [];
  const positioned: PositionedItem[] = [];
  let cluster: PositionedItem[] = [];

  function closeCluster() {
    if (cluster.length === 0) return;
    const columnCount = Math.max(...cluster.map((p) => p.column)) + 1;
    for (const p of cluster) p.columnCount = columnCount;
    cluster = [];
  }

  for (const item of timed) {
    const end = item.endAt ?? item.at + DEFAULT_BLOCK_MS;
    for (let i = active.length - 1; i >= 0; i--) {
      if (active[i].end <= item.at) active.splice(i, 1);
    }
    if (active.length === 0) closeCluster();

    const usedColumns = new Set(active.map((a) => a.column));
    let column = 0;
    while (usedColumns.has(column)) column++;

    const positionedItem: PositionedItem = { item, column, columnCount: 1 };
    active.push({ column, end });
    cluster.push(positionedItem);
    positioned.push(positionedItem);
  }
  closeCluster();

  return positioned;
}

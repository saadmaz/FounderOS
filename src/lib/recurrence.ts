import type { RecurrenceFrequency } from "./types";

/**
 * Hard cap on how many instances a single recurring series can generate.
 * There's no background job in this app to expand a recurrence rule lazily
 * (see src/lib/types/index.ts's Recurrence doc comment) - this is what
 * keeps "daily, forever" from writing an unbounded number of documents.
 */
export const MAX_RECURRENCE_INSTANCES = 52;

export interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  interval: number;
  endMode: "count" | "until";
  count?: number; // used when endMode === "count"
  until?: number; // epoch ms, used when endMode === "until"
}

/**
 * Expands a start time into every occurrence's start time for the series -
 * always includes `start` itself as the first entry. Each subsequent date
 * is `interval` frequency-units after the previous one (not the original
 * start), so month/day-of-week drift compounds the way a human would
 * expect. Capped at MAX_RECURRENCE_INSTANCES regardless of `count`/`until`.
 */
export function expandRecurrence(start: number, rule: RecurrenceRule): number[] {
  const dates = [start];
  const interval = Math.max(1, Math.floor(rule.interval) || 1);
  const limit =
    rule.endMode === "count"
      ? Math.min(MAX_RECURRENCE_INSTANCES, Math.max(1, Math.floor(rule.count ?? 1)))
      : MAX_RECURRENCE_INSTANCES;

  let cursor = new Date(start);
  while (dates.length < limit) {
    const next = new Date(cursor);
    if (rule.frequency === "daily") next.setDate(next.getDate() + interval);
    else if (rule.frequency === "weekly") next.setDate(next.getDate() + interval * 7);
    else next.setMonth(next.getMonth() + interval);

    if (rule.endMode === "until" && rule.until != null && next.getTime() > rule.until) break;

    dates.push(next.getTime());
    cursor = next;
  }
  return dates;
}

/** "Repeats weekly", "Repeats every 3 days", etc. - for a series badge. */
export function recurrenceSummary(frequency: RecurrenceFrequency, interval: number): string {
  const unit = { daily: "day", weekly: "week", monthly: "month" }[frequency];
  return interval <= 1 ? `Repeats ${frequency}` : `Repeats every ${interval} ${unit}s`;
}

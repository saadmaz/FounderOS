import type { TimeEntry } from "./types";

/**
 * Sums time entries to hours. A still-running entry (endedAt: null) counts
 * up to now - centralized here so "now" is read impurely in exactly one
 * place instead of scattered through every render path that needs hours.
 */
export function sumHours(entries: TimeEntry[]): number {
  const now = Date.now();
  return entries.reduce((sum, e) => sum + ((e.endedAt ?? now) - e.startedAt), 0) / 3_600_000;
}

export function formatCurrency(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatHours(hours: number) {
  return `${hours.toFixed(1)}h`;
}

export function formatDate(ms: number | null | undefined) {
  if (!ms) return "—";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(ms);
}

export function formatDateTime(ms: number | null | undefined) {
  if (!ms) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(ms);
}

export function initials(name: string) {
  return name
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

import type { Meeting, TimeEntry } from "./types";

/**
 * Sums time entries to hours. A still-running entry (endedAt: null) counts
 * up to now - centralized here so "now" is read impurely in exactly one
 * place instead of scattered through every render path that needs hours.
 */
export function sumHours(entries: TimeEntry[]): number {
  const now = Date.now();
  return entries.reduce((sum, e) => sum + ((e.endedAt ?? now) - e.startedAt), 0) / 3_600_000;
}

/**
 * Sums completed meetings' durations to hours. Only "completed" meetings
 * count - a scheduled meeting hasn't consumed anyone's time yet, and a
 * cancelled one never did, so neither belongs in an "hours logged" total.
 * Every "hours logged" figure that's scoped to a company should add this
 * to sumHours(timeEntries) for that company - meetings are time spent too.
 */
export function sumMeetingHours(meetings: Meeting[]): number {
  return (
    meetings
      .filter((m) => m.status === "completed")
      .reduce((sum, m) => sum + m.durationMinutes, 0) / 60
  );
}

// This workspace tracks finances in Sri Lankan Rupees by default - every
// currency field defaults to LKR (see company/expense/budget/investment
// forms), so that's the fallback here too.
export function formatCurrency(amount: number, currency = "LKR") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    // "narrowSymbol" over the default "symbol" so LKR renders as "Rs" -
    // en-US has no localized LKR symbol, so plain "symbol" falls back to
    // printing the ISO code ("LKR 1,000") instead of a currency mark.
    // Doesn't change the look of USD/EUR/GBP, which already have a
    // narrow-symbol form identical to their default one.
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * The currency to label a figure that's summed *across* companies (an
 * Overview stat card, an analytics chart) - each company's `currency`
 * field is authoritative, so if every company in view shares one, that's
 * the honest answer. A workspace with genuinely mixed currencies has no
 * single correct sum (there's no exchange-rate conversion here), so this
 * falls back to the workspace default rather than mislabeling the total
 * with whichever currency happened to be first.
 */
export function commonCurrency(companies: { currency: string }[], fallback = "LKR"): string {
  const first = companies[0]?.currency;
  return first && companies.every((c) => c.currency === first) ? first : fallback;
}

/**
 * Sums `amount` per distinct `currency` and formats each subtotal
 * separately, joined with " + " - the honest counterpart to summing
 * straight into a number and labeling it with commonCurrency's fallback.
 * That pattern (still used for a single-currency total, or to *label* a
 * mixed one) hides the mix: adding a $100 expense and a Rs 100 expense as
 * a raw "200" is wrong regardless of which currency symbol it's printed
 * with. This keeps every currency's subtotal visible instead - a no-op
 * (single formatted amount) whenever everything already shares one
 * currency, which is the common case. Still no exchange-rate conversion
 * (see commonCurrency) - this only ever keeps same-currency amounts summed
 * together, never converts one currency's value into another's.
 */
export function formatMixedCurrencyTotal(items: { amount: number; currency: string }[]): string {
  const byCurrency = new Map<string, number>();
  for (const item of items) {
    byCurrency.set(item.currency, (byCurrency.get(item.currency) ?? 0) + item.amount);
  }
  if (byCurrency.size === 0) return formatCurrency(0);
  return [...byCurrency.entries()]
    .sort((a, b) => b[1] - a[1]) // largest subtotal first
    .map(([currency, amount]) => formatCurrency(amount, currency))
    .join(" + ");
}

export function formatHours(hours: number) {
  return `${hours.toFixed(1)}h`;
}

/**
 * Local-calendar-date "YYYY-MM-DD" for a `<input type="date">` value -
 * pairs with the `new Date(\`${value}T00:00:00\`).getTime()` every
 * date-picker form uses to turn that string back into a timestamp (that
 * constructor reads a timezone-less string as local time). Reading a stored
 * timestamp back with `.toISOString()` instead reads it as UTC, which
 * silently shifts the date by a day in any timezone with a non-zero
 * offset - e.g. a date saved as local midnight in UTC+5:30 becomes 18:30 the
 * *previous* day in UTC, so re-opening the edit form would show, and then
 * resave, the wrong date. Always use this (not `.toISOString().slice(0,10)`)
 * to turn a stored timestamp into a date-input value.
 */
export function toDateInputValue(ms: number = Date.now()): string {
  const d = new Date(ms);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDate(ms: number | null | undefined) {
  if (!ms) return "—";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(ms);
}

export function formatDateTime(ms: number | null | undefined) {
  if (!ms) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(ms);
}

/** "Today" / "Yesterday" / "3d ago" for anything in the last week, falling
 * back to the plain date beyond that - for compact spots like a kanban
 * card where a full timestamp doesn't fit. */
export function formatRelativeDate(ms: number | null | undefined) {
  if (!ms) return "—";
  const dayMs = 86_400_000;
  const startOfDay = (t: number) => new Date(t).setHours(0, 0, 0, 0);
  const days = Math.round((startOfDay(Date.now()) - startOfDay(ms)) / dayMs);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days > 1 && days < 7) return `${days}d ago`;
  return formatDate(ms);
}

/** Bytes as a short human-readable size (KB/MB/GB). Shared by every place
 * that lists uploaded files (Documents, per-company Documents, ...). */
export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

export function initials(name: string) {
  return name
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

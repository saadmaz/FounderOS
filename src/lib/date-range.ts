export type DateRangePreset = "all" | "this_month" | "last_month" | "this_year";

export const DATE_RANGE_PRESETS: { value: DateRangePreset; label: string }[] = [
  { value: "all", label: "All time" },
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "this_year", label: "This year" },
];

// `new Date()` (today) is read impurely in exactly this one place (mirrors
// the convention in meeting-card.tsx's meetingDateBucket) so a component
// calling this doesn't read the current date directly during render.
/** [start, end) epoch millis for a preset, or null for "all" (no filtering). */
export function dateRangePresetBounds(preset: DateRangePreset, today = new Date()): [number, number] | null {
  if (preset === "all") return null;
  if (preset === "this_year") {
    return [new Date(today.getFullYear(), 0, 1).getTime(), new Date(today.getFullYear() + 1, 0, 1).getTime()];
  }
  const monthOffset = preset === "last_month" ? -1 : 0;
  const start = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const end = new Date(today.getFullYear(), today.getMonth() + monthOffset + 1, 1);
  return [start.getTime(), end.getTime()];
}

// ===================== Dashboard reporting period =====================

export type DashboardPeriod = "this_week" | "last_week" | "last_month" | "last_year" | "custom";

export const DASHBOARD_PERIODS: { value: DashboardPeriod; label: string }[] = [
  { value: "this_week", label: "This week" },
  { value: "last_week", label: "Last week" },
  { value: "last_month", label: "Last month" },
  { value: "last_year", label: "Last year" },
  { value: "custom", label: "Custom range" },
];

const DAY_MS = 86_400_000;

function mondayOf(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); // Monday = 0
  return x;
}

/** "yyyy-MM-dd" (local) -> local-midnight epoch millis, or null if blank. */
function parseDateInput(v: string): number | null {
  return v ? new Date(`${v}T00:00:00`).getTime() : null;
}

/**
 * [start, end) epoch millis for a dashboard period, plus the matching
 * window right before it (for "vs previous period" deltas). Calendar
 * periods, not rolling ones: "last month" is the whole previous calendar
 * month, "last year" the whole previous calendar year, "last week" the
 * previous Monday-Sunday. A custom range is inclusive of both picked days;
 * null when it isn't fully picked (or is backwards) yet.
 */
export function dashboardPeriodBounds(
  period: DashboardPeriod,
  custom: { from: string; to: string },
  today = new Date()
): { range: [number, number]; previous: [number, number] } | null {
  const y = today.getFullYear();
  const m = today.getMonth();
  switch (period) {
    case "this_week":
    case "last_week": {
      const thisMonday = mondayOf(today).getTime();
      const start = period === "this_week" ? thisMonday : thisMonday - 7 * DAY_MS;
      // This week runs to the end of today, not next Monday - the future
      // part of the week has nothing in it yet.
      const end =
        period === "this_week"
          ? new Date(y, m, today.getDate() + 1).getTime()
          : thisMonday;
      return { range: [start, end], previous: [start - 7 * DAY_MS, start] };
    }
    case "last_month":
      return {
        range: [new Date(y, m - 1, 1).getTime(), new Date(y, m, 1).getTime()],
        previous: [new Date(y, m - 2, 1).getTime(), new Date(y, m - 1, 1).getTime()],
      };
    case "last_year":
      return {
        range: [new Date(y - 1, 0, 1).getTime(), new Date(y, 0, 1).getTime()],
        previous: [new Date(y - 2, 0, 1).getTime(), new Date(y - 1, 0, 1).getTime()],
      };
    case "custom": {
      const from = parseDateInput(custom.from);
      const to = parseDateInput(custom.to);
      if (from === null || to === null || to < from) return null;
      const end = new Date(to);
      end.setDate(end.getDate() + 1);
      const length = end.getTime() - from;
      return { range: [from, end.getTime()], previous: [from - length, from] };
    }
  }
}

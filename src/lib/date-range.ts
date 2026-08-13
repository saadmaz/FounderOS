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

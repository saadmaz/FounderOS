import { PRIORITIES, PROJECT_STATUSES, TASK_STATUSES } from "@/lib/types";

/**
 * Base UI's <Select.Value> renders the raw value string unless given a
 * render function - unlike Radix, it does NOT mirror the matching Item's
 * label automatically. Every status/priority Select must pass one of
 * these to <SelectValue> or it'll display "in_progress" instead of
 * "In Progress".
 */
function buildLookup<T extends string>(options: { value: T; label: string }[]) {
  const map = new Map(options.map((o) => [o.value, o.label]));
  return (value: T) => map.get(value) ?? value;
}

export const taskStatusLabel = buildLookup(TASK_STATUSES);
export const projectStatusLabel = buildLookup(PROJECT_STATUSES);
export const priorityLabel = buildLookup(PRIORITIES);

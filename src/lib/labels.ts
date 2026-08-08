import { COMPANY_TYPES, PRIORITIES, PROJECT_STATUSES, TASK_STATUSES } from "@/lib/types";
import type { Company, Project, Task } from "@/lib/types";

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
export const companyTypeLabel = buildLookup(COMPANY_TYPES);

/**
 * What a time entry reads as: the most specific thing picked (task, then
 * project, then company), falling back to a freeform note - so "log time
 * on anything" degrades gracefully to just the note when nothing else was
 * selected. Computed once at write time and stored as TimeEntry.subjectLabel.
 */
export function timeEntrySubjectLabel(target: {
  company?: Pick<Company, "name">;
  project?: Pick<Project, "name">;
  task?: Pick<Task, "title">;
  note?: string;
}): string {
  const note = target.note?.trim();
  return target.task?.title || target.project?.name || note || target.company?.name || "Untitled";
}

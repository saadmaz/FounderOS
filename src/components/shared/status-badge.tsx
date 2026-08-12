import type { CompanyStatus, Priority, ProjectStatus, TaskStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  not_started: "bg-muted text-muted-foreground",
  in_progress: "bg-primary/10 text-primary",
  blocked: "bg-danger/10 text-danger",
  in_review: "bg-analytics-purple/10 text-analytics-purple",
  completed: "bg-success/10 text-success",
  cancelled: "bg-muted text-muted-foreground-2 line-through",
  on_hold: "bg-warning/10 text-warning",
  active: "bg-success/10 text-success",
  paused: "bg-warning/10 text-warning",
  archived: "bg-muted text-muted-foreground-2",
  exploring: "bg-primary/10 text-primary",
};

const STATUS_LABELS: Record<string, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  blocked: "Blocked",
  in_review: "In Review",
  completed: "Completed",
  cancelled: "Cancelled",
  on_hold: "On Hold",
  active: "Active",
  paused: "Paused",
  archived: "Archived",
  exploring: "Exploring",
};

export function StatusBadge({ status }: { status: TaskStatus | ProjectStatus | CompanyStatus }) {
  return (
    <span
      className={cn(
        // ring-current/dot-bg-current both pick up whatever text color the
        // status map assigns below, so each status gets a matching dot and
        // hairline ring for free without a second color map to keep in sync.
        "inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ring-current/15",
        STATUS_STYLES[status]
      )}
    >
      <span className="size-1.5 shrink-0 rounded-full bg-current" />
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

const PRIORITY_STYLES: Record<Priority, string> = {
  critical: "bg-danger/10 text-danger",
  high: "bg-warning/10 text-warning",
  medium: "bg-primary/10 text-primary",
  low: "bg-muted text-muted-foreground-2",
};

const PRIORITY_LABELS: Record<Priority, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ring-current/15",
        PRIORITY_STYLES[priority]
      )}
    >
      <span className="size-1.5 shrink-0 rounded-full bg-current" />
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

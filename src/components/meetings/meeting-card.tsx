"use client";

import { motion } from "framer-motion";
import {
  Calendar,
  CalendarCheck,
  CalendarSync,
  CalendarX2,
  MapPin,
  MoreHorizontal,
  NotebookPen,
  Pencil,
  Trash2,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { addDays, startOfDay } from "@/lib/calendar-items";
import { formatDateTime, initials } from "@/lib/format";
import { recurrenceSummary } from "@/lib/recurrence";
import { richTextToPlainText } from "@/lib/rich-text";
import type { Company, Meeting, MeetingStatus, WorkspaceMember } from "@/lib/types";
import { cn } from "@/lib/utils";

const MEETING_STATUS_STYLES: Record<MeetingStatus, string> = {
  scheduled: "bg-primary/10 text-primary",
  completed: "bg-success/10 text-success",
  cancelled: "bg-muted text-muted-foreground",
};

const MEETING_STATUS_LABELS: Record<MeetingStatus, string> = {
  scheduled: "Scheduled",
  completed: "Completed",
  cancelled: "Cancelled",
};

export function MeetingStatusBadge({ status }: { status: MeetingStatus }) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium",
        MEETING_STATUS_STYLES[status]
      )}
    >
      {MEETING_STATUS_LABELS[status]}
    </span>
  );
}

export function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

// `Date.now()` is read impurely in exactly this one place (mirrors the
// convention in src/lib/format.ts's sumHours) so components don't call it
// directly during render.
export function isUpcoming(meeting: Meeting) {
  return meeting.status === "scheduled" && meeting.scheduledAt >= Date.now();
}

export type MeetingDateFilter = "today" | "upcoming" | "past";

/**
 * Buckets a meeting by calendar day relative to now, for the Today /
 * Upcoming / Past filter on the company meetings tab - a plain date
 * partition (unlike `isUpcoming`, which also filters by status) so every
 * meeting lands in exactly one bucket regardless of scheduled/completed/
 * cancelled state.
 */
export function meetingDateBucket(meeting: Meeting, now = Date.now()): MeetingDateFilter {
  const todayStart = startOfDay(now);
  const todayEnd = addDays(todayStart, 1);
  if (meeting.scheduledAt < todayStart) return "past";
  return meeting.scheduledAt < todayEnd ? "today" : "upcoming";
}

export function MeetingCard({
  meeting,
  index,
  company,
  showCompany = true,
  members,
  onEdit,
  onStatusChange,
  onDelete,
  onDeleteSeries,
  onOpenNotes,
  onViewNotes,
}: {
  meeting: Meeting;
  index: number;
  company?: Company;
  showCompany?: boolean;
  members: WorkspaceMember[];
  onEdit: (meeting: Meeting) => void;
  onStatusChange: (meeting: Meeting, status: MeetingStatus) => void;
  onDelete: (meeting: Meeting) => void;
  onDeleteSeries?: (meeting: Meeting) => void;
  onOpenNotes: (meeting: Meeting) => void;
  /** Clicking the notes preview should open a read-only view, not drop
   * straight into editing - falls back to onOpenNotes if not provided. */
  onViewNotes?: (meeting: Meeting) => void;
}) {
  function memberFor(memberId: string) {
    return members.find((m) => m.id === memberId);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.03 }}
      className="group relative flex h-full flex-col rounded-xl border border-border bg-card p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {showCompany && company && (
              <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: company.color }} />
            )}
            <p className="truncate text-sm font-semibold">{meeting.title}</p>
          </div>
          {showCompany && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {company?.name ?? "Unknown company"}
            </p>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="size-7 shrink-0" aria-label="Meeting actions" />}>
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(meeting)}>
              <Pencil className="size-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onOpenNotes(meeting)}>
              <NotebookPen className="size-4" />
              {meeting.notes ? "Edit notes" : "Add notes"}
            </DropdownMenuItem>
            {meeting.status !== "completed" && (
              <DropdownMenuItem onClick={() => onStatusChange(meeting, "completed")}>
                <CalendarCheck className="size-4" />
                Mark completed
              </DropdownMenuItem>
            )}
            {meeting.status !== "cancelled" && (
              <DropdownMenuItem onClick={() => onStatusChange(meeting, "cancelled")}>
                <CalendarX2 className="size-4" />
                Mark cancelled
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => onDelete(meeting)}>
              <Trash2 className="size-4" />
              Delete{meeting.recurrence ? " this meeting" : ""}
            </DropdownMenuItem>
            {meeting.recurrence && onDeleteSeries && (
              <DropdownMenuItem variant="destructive" onClick={() => onDeleteSeries(meeting)}>
                <Trash2 className="size-4" />
                Delete entire series
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Calendar className="size-3.5" />
          {formatDateTime(meeting.scheduledAt)} · {formatDuration(meeting.durationMinutes)}
        </span>
        {meeting.recurrence && (
          <span className="flex items-center gap-1.5" title={`${meeting.recurrence.index + 1} of ${meeting.recurrence.count}`}>
            <CalendarSync className="size-3.5" />
            {recurrenceSummary(meeting.recurrence.frequency, meeting.recurrence.interval)}
          </span>
        )}
        {meeting.location && (
          <span className="flex items-center gap-1.5 truncate">
            <MapPin className="size-3.5 shrink-0" />
            <span className="truncate">{meeting.location}</span>
          </span>
        )}
      </div>

      {meeting.agenda && <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{meeting.agenda}</p>}

      {meeting.notes && (
        <button
          type="button"
          onClick={() => (onViewNotes ?? onOpenNotes)(meeting)}
          className="mt-2 flex w-full items-start gap-1.5 rounded-lg bg-secondary/60 p-2 text-left transition-colors hover:bg-secondary"
        >
          <NotebookPen className="mt-0.5 size-3 shrink-0 text-muted-foreground-2" />
          <span className="line-clamp-2 text-xs text-muted-foreground">
            {richTextToPlainText(meeting.notes)}
          </span>
        </button>
      )}

      <div className="mt-auto flex items-center justify-between border-t border-border pt-3">
        <div className="flex items-center gap-1.5">
          {meeting.attendeeIds.length === 0 ? (
            <span className="flex items-center gap-1 text-xs text-muted-foreground-2">
              <Users className="size-3.5" />
              No attendees
            </span>
          ) : (
            <div className="flex -space-x-2">
              {meeting.attendeeIds.slice(0, 5).map((id) => {
                const member = memberFor(id);
                return (
                  <span
                    key={id}
                    title={member?.displayName ?? member?.email ?? id}
                    className="flex size-6 items-center justify-center rounded-full border-2 border-card bg-secondary text-[10px] font-medium text-secondary-foreground"
                  >
                    {member ? initials(member.displayName || member.email) : "?"}
                  </span>
                );
              })}
              {meeting.attendeeIds.length > 5 && (
                <span className="flex size-6 items-center justify-center rounded-full border-2 border-card bg-muted text-[10px] font-medium text-muted-foreground">
                  +{meeting.attendeeIds.length - 5}
                </span>
              )}
            </div>
          )}
        </div>
        <MeetingStatusBadge status={meeting.status} />
      </div>
    </motion.div>
  );
}

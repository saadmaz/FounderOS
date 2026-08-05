"use client";

import { motion } from "framer-motion";
import {
  Calendar,
  CalendarCheck,
  CalendarX2,
  MapPin,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MeetingFormDialog } from "@/components/meetings/meeting-form-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { useCompanies } from "@/lib/data/companies";
import { deleteMeeting, setMeetingStatus, useMeetings } from "@/lib/data/meetings";
import { useMembers } from "@/lib/data/members";
import { formatDateTime, initials } from "@/lib/format";
import type { Meeting, MeetingStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/lib/workspace/workspace-provider";

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

function MeetingStatusBadge({ status }: { status: MeetingStatus }) {
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

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

// `Date.now()` is read impurely in exactly this one place (mirrors the
// convention in src/lib/format.ts's sumHours) so components don't call it
// directly during render.
function isUpcoming(meeting: Meeting) {
  return meeting.status === "scheduled" && meeting.scheduledAt >= Date.now();
}

export default function MeetingsPage() {
  const { workspace } = useWorkspace();
  const { data: meetings, loading } = useMeetings(workspace?.id ?? null);
  const { data: companies } = useCompanies(workspace?.id ?? null);
  const { data: members } = useMembers(workspace?.id ?? null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Meeting | null>(null);

  const upcoming = useMemo(
    () => meetings.filter(isUpcoming).sort((a, b) => a.scheduledAt - b.scheduledAt),
    [meetings]
  );
  const past = useMemo(
    () => meetings.filter((m) => !isUpcoming(m)).sort((a, b) => b.scheduledAt - a.scheduledAt),
    [meetings]
  );

  function companyFor(companyId: string) {
    return companies.find((c) => c.id === companyId);
  }

  function memberFor(memberId: string) {
    return members.find((m) => m.id === memberId);
  }

  async function handleStatus(meeting: Meeting, status: MeetingStatus) {
    if (!workspace) return;
    await setMeetingStatus(workspace.id, meeting.id, status);
    toast.success(
      status === "completed" ? "Meeting marked completed" : "Meeting cancelled"
    );
  }

  async function handleDelete(meeting: Meeting) {
    if (!workspace) return;
    if (!window.confirm(`Delete "${meeting.title}"? This can't be undone.`)) return;
    await deleteMeeting(workspace.id, meeting.id);
    toast.success("Meeting deleted");
  }

  function MeetingCard({ meeting, index }: { meeting: Meeting; index: number }) {
    const company = companyFor(meeting.companyId);
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: index * 0.03 }}
        className="group relative rounded-xl border border-border bg-card p-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {company && (
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: company.color }}
                />
              )}
              <p className="truncate text-sm font-semibold">{meeting.title}</p>
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {company?.name ?? "Unknown company"}
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon" className="size-7 shrink-0" />}
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setEditing(meeting)}>
                <Pencil className="size-4" />
                Edit
              </DropdownMenuItem>
              {meeting.status !== "completed" && (
                <DropdownMenuItem onClick={() => handleStatus(meeting, "completed")}>
                  <CalendarCheck className="size-4" />
                  Mark completed
                </DropdownMenuItem>
              )}
              {meeting.status !== "cancelled" && (
                <DropdownMenuItem onClick={() => handleStatus(meeting, "cancelled")}>
                  <CalendarX2 className="size-4" />
                  Mark cancelled
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => handleDelete(meeting)}>
                <Trash2 className="size-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Calendar className="size-3.5" />
            {formatDateTime(meeting.scheduledAt)} · {formatDuration(meeting.durationMinutes)}
          </span>
          {meeting.location && (
            <span className="flex items-center gap-1.5 truncate">
              <MapPin className="size-3.5 shrink-0" />
              <span className="truncate">{meeting.location}</span>
            </span>
          )}
        </div>

        {meeting.agenda && (
          <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{meeting.agenda}</p>
        )}

        <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
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

  return (
    <>
      <PageHeader
        title="Meetings"
        description={`${upcoming.length} upcoming meeting${upcoming.length === 1 ? "" : "s"}`}
        actions={
          <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
            <Plus className="size-4" />
            New meeting
          </Button>
        }
      />

      <div className="flex-1 p-4 lg:p-6">
        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-40 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : meetings.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title="No meetings yet"
            description="Schedule your first meeting to keep agendas, attendees, and notes in one place."
            action={
              <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
                <Plus className="size-4" />
                New meeting
              </Button>
            }
          />
        ) : (
          <>
            <div>
              <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground-2">
                Upcoming
              </h2>
              {upcoming.length === 0 ? (
                <p className="text-sm text-muted-foreground">No upcoming meetings scheduled.</p>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {upcoming.map((m, i) => (
                    <MeetingCard key={m.id} meeting={m} index={i} />
                  ))}
                </div>
              )}
            </div>

            {past.length > 0 && (
              <div className="mt-8">
                <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground-2">
                  Past
                </h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {past.map((m, i) => (
                    <MeetingCard key={m.id} meeting={m} index={i} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <MeetingFormDialog open={createOpen} onOpenChange={setCreateOpen} />
      <MeetingFormDialog
        open={Boolean(editing)}
        onOpenChange={(v) => !v && setEditing(null)}
        meeting={editing}
      />
    </>
  );
}

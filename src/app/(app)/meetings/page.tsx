"use client";

import { Calendar, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MeetingCard, isUpcoming } from "@/components/meetings/meeting-card";
import { MeetingFormDialog } from "@/components/meetings/meeting-form-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { useCompanies } from "@/lib/data/companies";
import { deleteMeeting, deleteMeetingSeries, setMeetingStatus, useMeetings } from "@/lib/data/meetings";
import { useMembers } from "@/lib/data/members";
import type { Meeting, MeetingStatus } from "@/lib/types";
import { useWorkspace } from "@/lib/workspace/workspace-provider";

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

  async function handleDeleteSeries(meeting: Meeting) {
    if (!workspace || !meeting.recurrence) return;
    if (
      !window.confirm(
        `Delete all ${meeting.recurrence.count} meetings in "${meeting.title}"'s series? This can't be undone.`
      )
    )
      return;
    await deleteMeetingSeries(workspace.id, meeting.recurrence.groupId);
    toast.success("Series deleted");
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
                    <MeetingCard
                      key={m.id}
                      meeting={m}
                      index={i}
                      company={companies.find((c) => c.id === m.companyId)}
                      members={members}
                      onEdit={setEditing}
                      onStatusChange={handleStatus}
                      onDelete={handleDelete}
                      onDeleteSeries={handleDeleteSeries}
                    />
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
                    <MeetingCard
                      key={m.id}
                      meeting={m}
                      index={i}
                      company={companies.find((c) => c.id === m.companyId)}
                      members={members}
                      onEdit={setEditing}
                      onStatusChange={handleStatus}
                      onDelete={handleDelete}
                      onDeleteSeries={handleDeleteSeries}
                    />
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

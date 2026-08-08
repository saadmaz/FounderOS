"use client";

import { Calendar, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { isUpcoming, MeetingCard } from "@/components/meetings/meeting-card";
import { MeetingFormDialog } from "@/components/meetings/meeting-form-dialog";
import { MeetingNotesDialog } from "@/components/meetings/meeting-notes-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { deleteMeeting, deleteMeetingSeries, setMeetingStatus, useMeetings } from "@/lib/data/meetings";
import { useMembers } from "@/lib/data/members";
import type { Company, Meeting, MeetingStatus } from "@/lib/types";
import { useWorkspace } from "@/lib/workspace/workspace-provider";

/**
 * Meetings tab for a single company's detail page. Mirrors the
 * workspace-wide Meetings page but pre-scoped to one company - no company
 * picker or badge, and new meetings default to this company.
 */
export function CompanyMeetingsPanel({ company }: { company: Company }) {
  const { workspace } = useWorkspace();
  const { data: meetings, loading } = useMeetings(workspace?.id ?? null, company.id);
  const { data: members } = useMembers(workspace?.id ?? null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Meeting | null>(null);
  const [notesFor, setNotesFor] = useState<Meeting | null>(null);

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
    toast.success(status === "completed" ? "Meeting marked completed" : "Meeting cancelled");
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
    <div className="flex flex-1 flex-col">
      <div className="flex items-center justify-between px-4 pt-4 lg:px-6">
        <p className="text-sm text-muted-foreground">
          {upcoming.length} upcoming meeting{upcoming.length === 1 ? "" : "s"}
        </p>
        <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5">
          <Plus className="size-4" />
          New meeting
        </Button>
      </div>

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
            description={`Schedule your first meeting for ${company.name}.`}
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
                      showCompany={false}
                      members={members}
                      onEdit={setEditing}
                      onStatusChange={handleStatus}
                      onDelete={handleDelete}
                      onDeleteSeries={handleDeleteSeries}
                      onOpenNotes={setNotesFor}
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
                      showCompany={false}
                      members={members}
                      onEdit={setEditing}
                      onStatusChange={handleStatus}
                      onDelete={handleDelete}
                      onDeleteSeries={handleDeleteSeries}
                      onOpenNotes={setNotesFor}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <MeetingFormDialog open={createOpen} onOpenChange={setCreateOpen} defaultCompanyId={company.id} />
      <MeetingFormDialog
        open={Boolean(editing)}
        onOpenChange={(v) => !v && setEditing(null)}
        meeting={editing}
        defaultCompanyId={company.id}
      />
      {workspace && (
        <MeetingNotesDialog
          open={Boolean(notesFor)}
          onOpenChange={(v) => !v && setNotesFor(null)}
          meeting={notesFor}
          workspaceId={workspace.id}
        />
      )}
    </div>
  );
}

"use client";

import { Calendar, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MeetingCard, isUpcoming } from "@/components/meetings/meeting-card";
import { MeetingFormDialog } from "@/components/meetings/meeting-form-dialog";
import { MeetingNotesDialog } from "@/components/meetings/meeting-notes-dialog";
import { MeetingNotesViewDialog } from "@/components/meetings/meeting-notes-view-dialog";
import { CardGridSkeleton } from "@/components/shared/card-grid-skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { TaskFormDialog } from "@/components/tasks/task-form-dialog";
import { useConfirm } from "@/lib/confirm/confirm-provider";
import { useCompanies } from "@/lib/data/companies";
import { deleteMeeting, deleteMeetingSeries, setMeetingStatus, useMeetings } from "@/lib/data/meetings";
import { useMembers } from "@/lib/data/members";
import { formatDate } from "@/lib/format";
import { buildIcsEvent, downloadIcs } from "@/lib/ics";
import type { Meeting, MeetingStatus } from "@/lib/types";
import { useWorkspace } from "@/lib/workspace/workspace-provider";

export default function MeetingsPage() {
  const { workspace } = useWorkspace();
  const confirm = useConfirm();
  const { data: meetings, loading } = useMeetings(workspace?.id ?? null);
  const { data: companies } = useCompanies(workspace?.id ?? null);
  const { data: members } = useMembers(workspace?.id ?? null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Meeting | null>(null);
  const [notesFor, setNotesFor] = useState<Meeting | null>(null);
  const [viewingNotesFor, setViewingNotesFor] = useState<Meeting | null>(null);
  const [convertingMeeting, setConvertingMeeting] = useState<Meeting | null>(null);

  // Archiving a company tucks its meetings out of this shared list - still
  // visible on the company's own page, just not cluttering everyone else's.
  const visibleMeetings = useMemo(() => {
    const archivedCompanyIds = new Set(
      companies.filter((c) => c.status === "archived").map((c) => c.id)
    );
    return meetings.filter((m) => !archivedCompanyIds.has(m.companyId));
  }, [meetings, companies]);

  const upcoming = useMemo(
    () => visibleMeetings.filter(isUpcoming).sort((a, b) => a.scheduledAt - b.scheduledAt),
    [visibleMeetings]
  );
  const past = useMemo(
    () => visibleMeetings.filter((m) => !isUpcoming(m)).sort((a, b) => b.scheduledAt - a.scheduledAt),
    [visibleMeetings]
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
    if (!(await confirm(`Delete "${meeting.title}"? This can't be undone.`))) return;
    await deleteMeeting(workspace.id, meeting.id);
    toast.success("Meeting deleted");
  }

  async function handleDeleteSeries(meeting: Meeting) {
    if (!workspace || !meeting.recurrence) return;
    const ok = await confirm(
      `Delete all ${meeting.recurrence.count} meetings in "${meeting.title}"'s series? This can't be undone.`
    );
    if (!ok) return;
    await deleteMeetingSeries(workspace.id, meeting.recurrence.groupId);
    toast.success("Series deleted");
  }

  function handleExportIcs(meeting: Meeting) {
    const attendees = meeting.attendeeIds
      .map((id) => members.find((m) => m.id === id))
      .filter((m): m is NonNullable<typeof m> => Boolean(m));
    const content = buildIcsEvent(meeting, attendees);
    const filename = `${meeting.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "meeting"}.ics`;
    downloadIcs(filename, content);
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
          <CardGridSkeleton cardClassName="h-40" />
        ) : visibleMeetings.length === 0 ? (
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
                      onOpenNotes={setNotesFor}
                      onViewNotes={setViewingNotesFor}
                      onConvertToTask={setConvertingMeeting}
                      onExportIcs={handleExportIcs}
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
                      onOpenNotes={setNotesFor}
                      onViewNotes={setViewingNotesFor}
                      onConvertToTask={setConvertingMeeting}
                      onExportIcs={handleExportIcs}
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
      {workspace && (
        <>
          <MeetingNotesDialog
            open={Boolean(notesFor)}
            onOpenChange={(v) => !v && setNotesFor(null)}
            meeting={notesFor}
            workspaceId={workspace.id}
          />
          <MeetingNotesViewDialog
            open={Boolean(viewingNotesFor)}
            onOpenChange={(v) => !v && setViewingNotesFor(null)}
            meeting={viewingNotesFor}
            onEdit={(m) => {
              setViewingNotesFor(null);
              setNotesFor(m);
            }}
          />
        </>
      )}

      <TaskFormDialog
        open={Boolean(convertingMeeting)}
        onOpenChange={(v) => !v && setConvertingMeeting(null)}
        defaultCompanyId={convertingMeeting?.companyId}
        defaultDescription={
          convertingMeeting
            ? `Follow-up from meeting: ${convertingMeeting.title} (${formatDate(convertingMeeting.scheduledAt)})`
            : undefined
        }
      />
    </>
  );
}

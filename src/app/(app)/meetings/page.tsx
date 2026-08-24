"use client";

import { Calendar, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MeetingCard, meetingDateBucket, type MeetingDateFilter } from "@/components/meetings/meeting-card";
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
import { scrollMainToTop } from "@/lib/scroll";
import type { Meeting, MeetingStatus } from "@/lib/types";
import { useWorkspace } from "@/lib/workspace/workspace-provider";

const EMPTY_MESSAGES: Record<MeetingDateFilter, string> = {
  today: "No meetings today.",
  upcoming: "No upcoming meetings scheduled.",
  past: "No past meetings yet.",
};

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
  // Defaults to "today" - same reasoning as the per-company Meetings tab
  // (see CompanyMeetingsPanel): landing on "what's happening today" beats
  // scrolling past every future recurring instance to find it.
  const [dateFilter, setDateFilter] = useState<MeetingDateFilter>("today");

  // Archiving a company tucks its meetings out of this shared list - still
  // visible on the company's own page, just not cluttering everyone else's.
  const visibleMeetings = useMemo(() => {
    const archivedCompanyIds = new Set(
      companies.filter((c) => c.status === "archived").map((c) => c.id)
    );
    return meetings.filter((m) => !archivedCompanyIds.has(m.companyId));
  }, [meetings, companies]);

  const buckets = useMemo(() => {
    const grouped: Record<MeetingDateFilter, Meeting[]> = { today: [], upcoming: [], past: [] };
    for (const m of visibleMeetings) grouped[meetingDateBucket(m)].push(m);
    grouped.today.sort((a, b) => a.scheduledAt - b.scheduledAt);
    grouped.upcoming.sort((a, b) => a.scheduledAt - b.scheduledAt);
    grouped.past.sort((a, b) => b.scheduledAt - a.scheduledAt);
    return grouped;
  }, [visibleMeetings]);

  const activeMeetings = buckets[dateFilter];

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
        description={`${buckets.upcoming.length} upcoming meeting${buckets.upcoming.length === 1 ? "" : "s"}`}
        actions={
          <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
            <Plus className="size-4" />
            New meeting
          </Button>
        }
      />

      {visibleMeetings.length > 0 && (
        <div className="border-b border-border px-4 pt-4 lg:px-6">
          <Tabs
            value={dateFilter}
            onValueChange={(v) => {
              setDateFilter((v as MeetingDateFilter) ?? "today");
              scrollMainToTop();
            }}
          >
            <TabsList>
              <TabsTrigger value="today">
                Today{buckets.today.length > 0 ? ` (${buckets.today.length})` : ""}
              </TabsTrigger>
              <TabsTrigger value="upcoming">
                Upcoming{buckets.upcoming.length > 0 ? ` (${buckets.upcoming.length})` : ""}
              </TabsTrigger>
              <TabsTrigger value="past">
                Past{buckets.past.length > 0 ? ` (${buckets.past.length})` : ""}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      )}

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
        ) : activeMeetings.length === 0 ? (
          <p className="text-sm text-muted-foreground">{EMPTY_MESSAGES[dateFilter]}</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {activeMeetings.map((m, i) => (
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

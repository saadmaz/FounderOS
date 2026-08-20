"use client";

import {
  ArrowLeft,
  Calendar,
  CalendarPlus,
  CalendarSync,
  ListTodo,
  MapPin,
  NotebookPen,
  Pencil,
  Trash2,
  Users,
} from "lucide-react";
import Link from "next/link";
import { notFound, useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DetailPageSkeleton } from "@/components/shared/detail-page-skeleton";
import { formatDuration, isUpcoming, MeetingStatusBadge } from "@/components/meetings/meeting-card";
import { MeetingFormDialog } from "@/components/meetings/meeting-form-dialog";
import { MeetingNotesDialog } from "@/components/meetings/meeting-notes-dialog";
import { MeetingNotesViewDialog } from "@/components/meetings/meeting-notes-view-dialog";
import { TaskFormDialog } from "@/components/tasks/task-form-dialog";
import { useConfirm } from "@/lib/confirm/confirm-provider";
import { useCompanies } from "@/lib/data/companies";
import { deleteMeeting, deleteMeetingSeries, setMeetingStatus, useMeetings } from "@/lib/data/meetings";
import { useMembers } from "@/lib/data/members";
import { formatDate, formatDateTime, initials } from "@/lib/format";
import { buildIcsEvent, downloadIcs } from "@/lib/ics";
import { recurrenceSummary } from "@/lib/recurrence";
import type { MeetingStatus } from "@/lib/types";
import { useWorkspace } from "@/lib/workspace/workspace-provider";

const URL_PATTERN = /^https?:\/\//i;

export default function MeetingDetailPage() {
  const { meetingId } = useParams<{ meetingId: string }>();
  const router = useRouter();
  const { workspace } = useWorkspace();
  const confirm = useConfirm();
  const { data: companies, loading: companiesLoading } = useCompanies(workspace?.id ?? null);
  const { data: members } = useMembers(workspace?.id ?? null);
  const { data: meetings, loading: meetingsLoading } = useMeetings(workspace?.id ?? null);
  const [editOpen, setEditOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [notesEditOpen, setNotesEditOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);

  const meeting = meetings.find((m) => m.id === meetingId);
  const company = companies.find((c) => c.id === meeting?.companyId);

  if (companiesLoading || meetingsLoading) {
    return <DetailPageSkeleton />;
  }
  if (!meeting) return notFound();

  const attendees = meeting.attendeeIds
    .map((id) => members.find((m) => m.id === id))
    .filter((m): m is NonNullable<typeof m> => Boolean(m));

  async function handleStatus(status: MeetingStatus) {
    if (!workspace || !meeting) return;
    await setMeetingStatus(workspace.id, meeting.id, status);
    toast.success(status === "completed" ? "Meeting marked completed" : "Meeting cancelled");
  }

  async function handleDelete() {
    if (!workspace || !meeting) return;
    if (!(await confirm(`Delete "${meeting.title}"? This can't be undone.`))) return;
    await deleteMeeting(workspace.id, meeting.id);
    toast.success("Meeting deleted");
    router.push("/meetings");
  }

  async function handleDeleteSeries() {
    if (!workspace || !meeting?.recurrence) return;
    if (
      !(await confirm(
        `Delete all ${meeting.recurrence.count} meetings in "${meeting.title}"'s series? This can't be undone.`
      ))
    )
      return;
    await deleteMeetingSeries(workspace.id, meeting.recurrence.groupId);
    toast.success("Series deleted");
    router.push("/meetings");
  }

  function handleExportIcs() {
    if (!meeting) return;
    const content = buildIcsEvent(meeting, attendees);
    const filename = `${meeting.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "meeting"}.ics`;
    downloadIcs(filename, content);
  }

  return (
    <>
      <div className="border-b border-border px-4 py-4 lg:px-6">
        <Link
          href="/meetings"
          className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          All meetings
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            {company && (
              <Link
                href={`/companies/${company.id}`}
                className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                <span className="size-1.5 rounded-full" style={{ backgroundColor: company.color }} />
                {company.name}
              </Link>
            )}
            <h1 className="mt-1 text-xl font-semibold tracking-tight">{meeting.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <MeetingStatusBadge status={meeting.status} />
              {isUpcoming(meeting) && (
                <span className="text-xs font-medium text-primary">Upcoming</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" aria-label="Edit meeting" onClick={() => setEditOpen(true)}>
              <Pencil className="size-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label="Delete meeting"
              className="text-danger hover:text-danger"
              onClick={handleDelete}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Calendar className="size-4" />
            {formatDateTime(meeting.scheduledAt)} · {formatDuration(meeting.durationMinutes)}
          </span>
          {meeting.recurrence && (
            <span
              className="flex items-center gap-1.5"
              title={`${meeting.recurrence.index + 1} of ${meeting.recurrence.count}`}
            >
              <CalendarSync className="size-4" />
              {recurrenceSummary(meeting.recurrence.frequency, meeting.recurrence.interval)}
            </span>
          )}
          {meeting.location && (
            <span className="flex items-center gap-1.5">
              <MapPin className="size-4 shrink-0" />
              {URL_PATTERN.test(meeting.location) ? (
                <a
                  href={meeting.location}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {meeting.location}
                </a>
              ) : (
                meeting.location
              )}
            </span>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setConvertOpen(true)}>
            <ListTodo className="size-3.5" />
            Create follow-up task
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={handleExportIcs}>
            <CalendarPlus className="size-3.5" />
            Add to calendar
          </Button>
          {meeting.status !== "completed" && (
            <Button size="sm" variant="ghost" onClick={() => handleStatus("completed")}>
              Mark completed
            </Button>
          )}
          {meeting.status !== "cancelled" && (
            <Button size="sm" variant="ghost" onClick={() => handleStatus("cancelled")}>
              Mark cancelled
            </Button>
          )}
          {meeting.recurrence && (
            <Button size="sm" variant="ghost" className="text-danger hover:text-danger" onClick={handleDeleteSeries}>
              Delete entire series
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 space-y-6 p-4 lg:p-6">
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            <Users className="size-4" />
            Attendees
          </h2>
          {attendees.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No attendees.</p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {attendees.map((m) => (
                <span
                  key={m.id}
                  className="flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium"
                >
                  <span className="flex size-5 items-center justify-center rounded-full bg-muted text-[9px]">
                    {initials(m.displayName || m.email)}
                  </span>
                  {m.displayName || m.email}
                </span>
              ))}
            </div>
          )}
        </section>

        {meeting.agenda && (
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold">Agenda</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{meeting.agenda}</p>
          </section>
        )}

        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold">
              <NotebookPen className="size-4" />
              Notes
            </h2>
            <Button size="sm" variant="ghost" onClick={() => setNotesOpen(true)}>
              {meeting.notes ? "View" : "Add notes"}
            </Button>
          </div>
        </section>
      </div>

      <MeetingFormDialog open={editOpen} onOpenChange={setEditOpen} meeting={meeting} />
      {workspace && (
        <>
          <MeetingNotesViewDialog
            open={notesOpen}
            onOpenChange={setNotesOpen}
            meeting={meeting}
            onEdit={() => {
              setNotesOpen(false);
              setNotesEditOpen(true);
            }}
          />
          <MeetingNotesDialog
            open={notesEditOpen}
            onOpenChange={setNotesEditOpen}
            meeting={meeting}
            workspaceId={workspace.id}
          />
        </>
      )}
      <TaskFormDialog
        open={convertOpen}
        onOpenChange={setConvertOpen}
        defaultCompanyId={meeting.companyId}
        defaultDescription={`Follow-up from meeting: ${meeting.title} (${formatDate(meeting.scheduledAt)})`}
      />
    </>
  );
}

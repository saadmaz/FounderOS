"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { updateMeeting } from "@/lib/data/meetings";
import { formatDateTime } from "@/lib/format";
import { isRichTextEmpty } from "@/lib/rich-text";
import type { Meeting } from "@/lib/types";

/**
 * A dedicated, lightweight dialog for jotting minutes after a meeting -
 * kept separate from MeetingFormDialog (which is about what's *planned*:
 * time, attendees, agenda) since notes are a different moment entirely,
 * written afterward and referred back to later. One field, one save.
 */
export function MeetingNotesDialog({
  open,
  onOpenChange,
  meeting,
  workspaceId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  meeting: Meeting | null;
  workspaceId: string;
}) {
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Sync the editable draft from `meeting.notes` whenever the dialog
  // transitions closed -> open (React's documented pattern for this -
  // avoids an extra effect + render, and re-syncing on every open discards
  // any unsaved draft left over from a cancelled edit).
  const [syncedOpen, setSyncedOpen] = useState(false);
  if (open !== syncedOpen) {
    setSyncedOpen(open);
    if (open) setNotes(meeting?.notes ?? "");
  }

  async function handleSave() {
    if (!meeting) return;
    setSaving(true);
    try {
      // An empty string (not `undefined`) so a cleared draft actually
      // overwrites the stored notes instead of updateDoc silently skipping
      // the field - see omitUndefined in lib/data/firestore-helpers.ts.
      await updateMeeting(workspaceId, meeting.id, { notes: isRichTextEmpty(notes) ? "" : notes });
      toast.success("Notes saved");
      onOpenChange(false);
    } catch {
      toast.error("Couldn't save notes. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Meeting notes</DialogTitle>
          {meeting && (
            <p className="text-xs text-muted-foreground">
              {meeting.title} · {formatDateTime(meeting.scheduledAt)}
            </p>
          )}
        </DialogHeader>

        <RichTextEditor
          autoFocus
          value={notes}
          onChange={setNotes}
          placeholder="What happened? Decisions, action items, follow-ups…"
          contentClassName="min-h-56"
        />

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save notes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

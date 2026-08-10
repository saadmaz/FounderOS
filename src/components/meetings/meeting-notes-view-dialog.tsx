"use client";

import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDateTime } from "@/lib/format";
import { isRichTextEmpty, sanitizeRichText } from "@/lib/rich-text";
import type { Meeting } from "@/lib/types";

/**
 * Read-only view of a meeting's notes, opened by clicking the notes preview
 * on a MeetingCard. Kept separate from MeetingNotesDialog (the editor) so
 * a click that's just "let me read this" doesn't drop the user straight
 * into an editable textbox - "Edit" here hands off to that dialog instead.
 */
export function MeetingNotesViewDialog({
  open,
  onOpenChange,
  meeting,
  onEdit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  meeting: Meeting | null;
  onEdit: (meeting: Meeting) => void;
}) {
  const empty = isRichTextEmpty(meeting?.notes);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Meeting notes</DialogTitle>
          {meeting && (
            <p className="text-xs text-muted-foreground">
              {meeting.title} · {formatDateTime(meeting.scheduledAt)}
            </p>
          )}
        </DialogHeader>

        {empty ? (
          <p className="rounded-lg bg-secondary/60 p-4 text-center text-sm text-muted-foreground">
            No notes yet.
          </p>
        ) : (
          <div
            className="rich-text max-h-[60vh] overflow-y-auto rounded-lg bg-secondary/40 p-3 text-sm leading-relaxed"
            // Notes only ever reach storage through sanitizeRichText (see
            // rich-text-editor.tsx), and are sanitized again here so this
            // stays safe even if a value was ever written another way.
            dangerouslySetInnerHTML={{ __html: sanitizeRichText(meeting?.notes ?? "") }}
          />
        )}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            type="button"
            className="gap-1.5"
            onClick={() => {
              onOpenChange(false);
              if (meeting) onEdit(meeting);
            }}
          >
            <Pencil className="size-3.5" />
            {empty ? "Add notes" : "Edit notes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

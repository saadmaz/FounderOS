"use client";

import { StickyNote, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/shared/empty-state";
import { useAuth } from "@/lib/auth/auth-provider";
import { addCompanyNote, deleteCompanyNote, useCompanyNotes } from "@/lib/data/company-notes";
import { formatDate } from "@/lib/format";
import type { Company } from "@/lib/types";
import { useWorkspace } from "@/lib/workspace/workspace-provider";

function toDateInputValue(ms: number) {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Notes tab for a single company's detail page - a dated journal, newest
 * first. Distinct from the single free-text `Company.notes` field on the
 * edit form: each entry here has its own date and can't be edited, only
 * added or removed (mirrors the CRM contact/deal activity timeline).
 */
export function CompanyNotesPanel({ company }: { company: Company }) {
  const { workspace } = useWorkspace();
  const { user } = useAuth();
  const { data: notes, loading } = useCompanyNotes(workspace?.id ?? null, company.id);
  const [date, setDate] = useState(() => toDateInputValue(Date.now()));
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleAdd() {
    const trimmed = text.trim();
    if (!workspace || !user || !trimmed || !date) return;
    setPosting(true);
    try {
      await addCompanyNote(workspace.id, {
        companyId: company.id,
        date: new Date(`${date}T00:00:00`).getTime(),
        text: trimmed,
        authorId: user.uid,
      });
      setText("");
      setDate(toDateInputValue(Date.now()));
    } catch {
      toast.error("Couldn't add the note. Try again.");
    } finally {
      setPosting(false);
    }
  }

  async function handleDelete(noteId: string) {
    if (!workspace) return;
    setDeletingId(noteId);
    try {
      await deleteCompanyNote(workspace.id, noteId);
    } catch {
      toast.error("Couldn't delete the note. Try again.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col p-4 lg:p-6">
      <div className="space-y-2 rounded-xl border border-border bg-surface/50 p-3">
        <DatePicker value={date} onChange={setDate} className="w-40" />
        <Textarea
          rows={3}
          placeholder={`Add a note about ${company.name}…`}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="flex justify-end">
          <Button type="button" size="sm" disabled={posting || !text.trim()} onClick={handleAdd}>
            {posting ? "Adding…" : "Add note"}
          </Button>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading notes…</p>
        ) : notes.length === 0 ? (
          <EmptyState
            icon={StickyNote}
            title="No notes yet"
            description={`Log dated notes about ${company.name} - updates, decisions, reminders.`}
          />
        ) : (
          notes.map((n) => (
            <div key={n.id} className="group flex gap-3 rounded-lg border border-border p-3">
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="text-xs font-medium text-muted-foreground">{formatDate(n.date)}</p>
                <p className="wrap-break-word text-sm">{n.text}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-6 shrink-0 opacity-0 group-hover:opacity-100"
                aria-label="Delete note"
                disabled={deletingId === n.id}
                onClick={() => handleDelete(n.id)}
              >
                <Trash2 className="size-3" />
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

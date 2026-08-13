"use client";

import { ExternalLink, Upload as UploadIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth/auth-provider";
import { updateDocument, uploadDocument } from "@/lib/data/documents";
import { formatFileSize } from "@/lib/format";
import type { Company, DocumentFile } from "@/lib/types";

/**
 * Create/edit dialog for a document. Uploading and editing share the same
 * Name/Company/Description fields - the only thing that differs is the file
 * picker (upload only) and which write call fires. Named `editingDocument`
 * rather than `document` so it can't shadow the DOM global inside this file.
 */
export function DocumentFormDialog({
  open,
  onOpenChange,
  workspaceId,
  companies,
  editingDocument,
  defaultCompanyId,
  contactId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  workspaceId: string;
  companies: Company[];
  editingDocument?: DocumentFile | null;
  defaultCompanyId?: string;
  /** Attaches an uploaded file to this contact (e.g. opened from a
   * contact's Documents tab) - invisible in the form, no contact picker. */
  contactId?: string;
}) {
  const { user } = useAuth();
  const isEditing = Boolean(editingDocument);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Identifies "what this dialog is currently showing" - a different value
  // every time it's opened fresh (a different document to edit, or opened
  // to upload again after being closed). Comparing against it during render
  // resets the fields below without a useEffect, which would otherwise fire
  // a render late and cause a state update outside of an event handler -
  // see https://react.dev/learn/you-might-not-need-an-effect#adjusting-state-based-on-a-prop-or-state-change.
  const sessionKey = open ? (editingDocument?.id ?? "create") : "closed";
  const [seededKey, setSeededKey] = useState(sessionKey);

  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState(editingDocument?.name ?? "");
  const [companyId, setCompanyId] = useState<string>(editingDocument?.companyId ?? defaultCompanyId ?? "none");
  const [description, setDescription] = useState(editingDocument?.description ?? "");
  const [submitting, setSubmitting] = useState(false);

  if (sessionKey !== seededKey) {
    setSeededKey(sessionKey);
    setFile(null);
    setName(editingDocument?.name ?? "");
    setDescription(editingDocument?.description ?? "");
    setCompanyId(editingDocument?.companyId ?? defaultCompanyId ?? "none");
  }

  // The native file input is uncontrolled - clear its displayed value in
  // lockstep with the reset above so picking the same filename again after
  // reopening still fires onChange.
  useEffect(() => {
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [sessionKey]);

  const trimmedName = name.trim();
  const trimmedDescription = description.trim();
  const canSubmit = Boolean(trimmedName) && Boolean(trimmedDescription) && (isEditing || Boolean(file));

  function handleFileChange(f: File | null) {
    setFile(f);
    // Filename becomes the default title - still fully editable below.
    if (f) setName(f.name);
  }

  async function handleSubmit() {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    try {
      if (isEditing && editingDocument) {
        await updateDocument(workspaceId, editingDocument.id, {
          name: trimmedName,
          description: trimmedDescription,
          companyId: companyId === "none" ? undefined : companyId,
        });
        toast.success("Document updated");
      } else if (file && user) {
        await uploadDocument(workspaceId, {
          file,
          name: trimmedName,
          companyId: companyId === "none" ? undefined : companyId,
          contactId,
          description: trimmedDescription,
          uploadedBy: user.uid,
        });
        toast.success(`${trimmedName} uploaded`);
      }
      onOpenChange(false);
    } catch (err) {
      // Surface the real reason (Cloudinary preset/size error, Firestore
      // permission-denied, ...) instead of a generic message - a bare
      // "throws an error" report gives no way to tell which without this.
      console.error(`Document ${isEditing ? "update" : "upload"} failed:`, err);
      toast.error(
        err instanceof Error
          ? err.message
          : `Couldn't ${isEditing ? "save changes" : "upload the file"}. Try again.`
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!submitting) onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit document" : "Upload document"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {isEditing && editingDocument ? (
            <a
              href={editingDocument.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground hover:underline"
            >
              <ExternalLink className="size-3.5" />
              View original file · {formatFileSize(editingDocument.size)}
            </a>
          ) : (
            <div className="space-y-1.5">
              <Label>File</Label>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={submitting}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-surface px-4 py-6 text-center transition-colors hover:border-white/25 disabled:pointer-events-none disabled:opacity-50"
              >
                <UploadIcon className="size-5 text-muted-foreground" />
                <span className="text-sm break-all">
                  {file ? file.name : "Tap to choose a file"}
                </span>
                {file && (
                  <span className="text-xs text-muted-foreground">{formatFileSize(file.size)}</span>
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="document-name">Name</Label>
            <Input
              id="document-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={submitting}
              maxLength={200}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Company (optional)</Label>
            <Select value={companyId} onValueChange={(v) => setCompanyId(v ?? "none")}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(v: string) => (v === "none" ? "No company" : companies.find((c) => c.id === v)?.name ?? v)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No company</SelectItem>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="document-description">Description</Label>
            <Textarea
              id="document-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={submitting}
              placeholder="What is this file? e.g. “Signed Q3 investor SAFE”"
              rows={3}
              maxLength={280}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !canSubmit}
            className="w-full sm:w-auto"
          >
            {isEditing ? (submitting ? "Saving…" : "Save changes") : submitting ? "Uploading…" : "Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

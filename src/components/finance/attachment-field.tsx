"use client";

import { FileText, Paperclip, Upload, X } from "lucide-react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { FinanceAttachment } from "@/lib/types";

/**
 * Multi-file picker for the receipts attached to an Expense - handles two
 * lists (already-saved attachments, new files staged for upload), either
 * of which can hold any number of files, not just one.
 */
export function AttachmentField({
  label,
  existing,
  onRemoveExisting,
  files,
  onFilesChange,
}: {
  label: string;
  existing: FinanceAttachment[];
  onRemoveExisting: (attachment: FinanceAttachment) => void;
  files: File[];
  onFilesChange: (files: File[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function addFiles(selected: FileList | null) {
    if (!selected || selected.length === 0) return;
    onFilesChange([...files, ...Array.from(selected)]);
  }

  function removeStagedFile(index: number) {
    onFilesChange(files.filter((_, i) => i !== index));
  }

  const hasAny = existing.length > 0 || files.length > 0;

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>

      {hasAny && (
        <div className="space-y-1.5">
          {existing.map((att) => (
            <div
              key={att.publicId}
              className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2"
            >
              <a
                href={att.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-w-0 items-center gap-2 text-sm hover:underline"
              >
                <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{att.name}</span>
              </a>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-6 shrink-0 text-muted-foreground-2 hover:text-danger"
                onClick={() => onRemoveExisting(att)}
              >
                <X className="size-3.5" />
              </Button>
            </div>
          ))}
          {files.map((file, i) => (
            <div
              key={`${file.name}-${i}`}
              className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2"
            >
              <span className="flex min-w-0 items-center gap-2 text-sm">
                <Paperclip className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{file.name}</span>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-6 shrink-0"
                onClick={() => removeStagedFile(i)}
              >
                <X className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-surface px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:border-white/25"
      >
        <Upload className="size-3.5" />
        {hasAny ? "Attach more files" : "Attach files"}
      </button>

      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          addFiles(e.target.files);
          // Reset so picking the same file again after removing it still fires onChange.
          e.target.value = "";
        }}
      />
    </div>
  );
}

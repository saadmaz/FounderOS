"use client";

import { FileText, Paperclip, Upload, X } from "lucide-react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { FinanceAttachment } from "@/lib/types";

/**
 * File picker for the receipt/invoice/bill attached to an Expense or
 * Invoice. Shared between both form dialogs rather than duplicated -
 * the three states (nothing attached / an already-saved attachment /
 * a new file staged for upload) are the same in both places.
 */
export function AttachmentField({
  label,
  existing,
  onRemoveExisting,
  file,
  onFileChange,
}: {
  label: string;
  existing?: FinanceAttachment | null;
  onRemoveExisting: () => void;
  file: File | null;
  onFileChange: (file: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>

      {file ? (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2">
          <span className="flex min-w-0 items-center gap-2 text-sm">
            <Paperclip className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{file.name}</span>
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-6 shrink-0"
            onClick={() => {
              onFileChange(null);
              if (inputRef.current) inputRef.current.value = "";
            }}
          >
            <X className="size-3.5" />
          </Button>
        </div>
      ) : existing ? (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2">
          <a
            href={existing.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-w-0 items-center gap-2 text-sm hover:underline"
          >
            <FileText className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{existing.name}</span>
          </a>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-6 shrink-0 text-muted-foreground-2 hover:text-danger"
            onClick={onRemoveExisting}
          >
            <X className="size-3.5" />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-surface px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:border-white/25"
        >
          <Upload className="size-3.5" />
          Attach a file
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}

"use client";

import { FileText, Paperclip } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { FinanceAttachment } from "@/lib/types";
import { cn } from "@/lib/utils";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * A single tappable "N attached" pill that opens a popover listing every
 * receipt/document, instead of one raw paperclip icon per file crowding the
 * row - keeps the row compact (important once several receipts pile up on
 * one expense) and gives each file a proper name/size, not just a link.
 */
export function AttachmentPreview({
  attachments,
  label,
  className,
}: {
  attachments?: FinanceAttachment[];
  label: string;
  className?: string;
}) {
  if (!attachments || attachments.length === 0) return null;

  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            title={`${attachments.length} ${label.toLowerCase()} attached`}
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-surface px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground-2 transition-colors hover:border-border-hover hover:text-foreground",
              className
            )}
          />
        }
      >
        <Paperclip className="size-3" />
        {attachments.length > 1 && attachments.length}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64">
        <PopoverHeader>
          <PopoverTitle>{label}</PopoverTitle>
        </PopoverHeader>
        <div className="space-y-1">
          {attachments.map((att) => (
            <a
              key={att.publicId}
              href={att.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-secondary"
            >
              <FileText className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate text-xs">{att.name}</span>
              <span className="shrink-0 text-[11px] text-muted-foreground-2">
                {formatFileSize(att.size)}
              </span>
            </a>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

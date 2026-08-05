"use client";

import {
  BookOpen,
  ExternalLink,
  GraduationCap,
  HelpCircle,
  Mic,
  MoreHorizontal,
  Newspaper,
  Plus,
  Star,
  Trash2,
  Video,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { LearningFormDialog } from "@/components/learning/learning-form-dialog";
import { deleteLearningItem, updateLearningItem, useLearningItems } from "@/lib/data/learning";
import { LEARNING_STATUSES, LEARNING_TYPES } from "@/lib/types";
import type { LearningItem, LearningStatus, LearningType } from "@/lib/types";
import { useWorkspace } from "@/lib/workspace/workspace-provider";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const TYPE_ICONS: Record<LearningType, LucideIcon> = {
  book: BookOpen,
  course: GraduationCap,
  article: Newspaper,
  podcast: Mic,
  video: Video,
  other: HelpCircle,
};

const COLUMNS: { status: LearningStatus; label: string; dot: string }[] = [
  { status: "queued", label: "Queued", dot: "bg-muted-foreground-2" },
  { status: "in_progress", label: "In Progress", dot: "bg-primary" },
  { status: "completed", label: "Completed", dot: "bg-success" },
];

function StarRow({
  rating,
  editable,
  onChange,
}: {
  rating: number;
  editable: boolean;
  onChange?: (value: number) => void;
}) {
  if (!editable && rating === 0) return null;
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!editable}
          onClick={() => onChange?.(n)}
          className={cn(!editable && "cursor-default")}
          aria-label={`Rate ${n} star${n === 1 ? "" : "s"}`}
        >
          <Star
            className={cn(
              "size-3.5",
              n <= rating ? "fill-warning text-warning" : "text-muted-foreground-2"
            )}
          />
        </button>
      ))}
    </div>
  );
}

function LearningCard({ item, workspaceId }: { item: LearningItem; workspaceId: string }) {
  const Icon = TYPE_ICONS[item.type];

  async function handleStatusChange(status: string) {
    await updateLearningItem(workspaceId, item.id, { status: status as LearningStatus });
  }

  async function handleRatingChange(rating: number) {
    await updateLearningItem(workspaceId, item.id, { rating });
  }

  async function handleDelete() {
    await deleteLearningItem(workspaceId, item.id);
    toast.success(`${item.title} removed`);
  }

  return (
    <div className="space-y-2.5 rounded-lg border border-border bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Icon className="size-4 shrink-0 text-muted-foreground" />
          <p className="truncate text-sm font-medium leading-snug">{item.title}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon-xs" />}>
            <MoreHorizontal className="size-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem variant="destructive" onClick={handleDelete}>
              <Trash2 className="size-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {item.notes && (
        <p className="line-clamp-2 text-xs text-muted-foreground">{item.notes}</p>
      )}

      <div className="flex items-center justify-between gap-2">
        <StarRow
          rating={item.rating ?? 0}
          editable={item.status === "completed"}
          onChange={handleRatingChange}
        />
        {item.url && (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <ExternalLink className="size-3.5" />
          </a>
        )}
      </div>

      <Select value={item.status} onValueChange={(v) => handleStatusChange(v ?? item.status)}>
        <SelectTrigger size="sm" className="w-full">
          <SelectValue>
            {(v: string) => LEARNING_STATUSES.find((s) => s.value === v)?.label ?? v}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {LEARNING_STATUSES.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export default function LearningPage() {
  const { workspace } = useWorkspace();
  const { data: items, loading } = useLearningItems(workspace?.id ?? null);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);

  const filtered = useMemo(
    () => (typeFilter === "all" ? items : items.filter((i) => i.type === typeFilter)),
    [items, typeFilter]
  );

  return (
    <>
      <PageHeader
        title="Learning"
        description={`${items.length} item${items.length === 1 ? "" : "s"} tracked`}
        actions={
          <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
            <Plus className="size-4" />
            New item
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5 lg:px-6">
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v ?? "all")}>
          <SelectTrigger size="sm" className="w-40">
            <SelectValue>
              {(v: string) =>
                v === "all" ? "All types" : LEARNING_TYPES.find((t) => t.value === v)?.label ?? v
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {LEARNING_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex-1 p-4 lg:p-6">
          <div className="h-full animate-pulse rounded-xl bg-muted" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-1 p-4 lg:p-6">
          <EmptyState
            icon={BookOpen}
            title="No learning items yet"
            description="Add a book, course, article, or video you want to work through."
            action={
              <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
                <Plus className="size-4" />
                New item
              </Button>
            }
          />
        </div>
      ) : (
        <div className="grid flex-1 grid-cols-1 gap-4 overflow-y-auto p-4 sm:grid-cols-3 lg:p-6">
          {COLUMNS.map((col) => {
            const colItems = filtered.filter((i) => i.status === col.status);
            return (
              <div
                key={col.status}
                className="flex flex-col rounded-xl border border-border bg-surface/50"
              >
                <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
                  <span className={cn("size-2 rounded-full", col.dot)} />
                  <span className="text-xs font-semibold">{col.label}</span>
                  <span className="ml-auto text-xs text-muted-foreground-2">{colItems.length}</span>
                </div>
                <div className="flex flex-1 flex-col gap-2 p-2">
                  {colItems.length === 0 ? (
                    <p className="p-3 text-center text-xs text-muted-foreground-2">Nothing here</p>
                  ) : (
                    colItems.map((item) => (
                      <LearningCard key={item.id} item={item} workspaceId={workspace!.id} />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <LearningFormDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}

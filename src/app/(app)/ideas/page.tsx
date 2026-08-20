"use client";

import { motion } from "framer-motion";
import { ArrowBigUp, Lightbulb, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { IdeaFormDialog } from "@/components/ideas/idea-form-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { useConfirm } from "@/lib/confirm/confirm-provider";
import { useCompanies } from "@/lib/data/companies";
import { deleteIdea, priorityScore, setIdeaStatus, updateIdea, upvoteIdea, useIdeas } from "@/lib/data/ideas";
import { createProject } from "@/lib/data/projects";
import { createTask } from "@/lib/data/tasks";
import { formatDate } from "@/lib/format";
import { IDEA_STATUSES, type Idea, type IdeaStatus } from "@/lib/types";
import { useWorkspace } from "@/lib/workspace/workspace-provider";
import { cn } from "@/lib/utils";

const IDEA_STATUS_STYLES: Record<IdeaStatus, string> = {
  new: "bg-primary/10 text-primary",
  considering: "bg-analytics-purple/10 text-analytics-purple",
  planned: "bg-analytics-cyan/10 text-analytics-cyan",
  in_progress: "bg-warning/10 text-warning",
  shipped: "bg-success/10 text-success",
  rejected: "bg-danger/10 text-danger",
};

const IDEA_STATUS_LABELS: Record<IdeaStatus, string> = Object.fromEntries(
  IDEA_STATUSES.map((s) => [s.value, s.label])
) as Record<IdeaStatus, string>;

const STATUS_FILTER_ALL = "all";
type SortMode = "votes" | "priority" | "newest";

export default function IdeasPage() {
  const { workspace } = useWorkspace();
  const confirm = useConfirm();
  const { data: ideas, loading } = useIdeas(workspace?.id ?? null);
  const { data: companies } = useCompanies(workspace?.id ?? null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingIdea, setEditingIdea] = useState<Idea | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>(STATUS_FILTER_ALL);
  const [sort, setSort] = useState<SortMode>("votes");
  const [convertTarget, setConvertTarget] = useState<{ idea: Idea; type: "task" | "project" } | null>(null);
  const [convertCompanyId, setConvertCompanyId] = useState("");
  const [converting, setConverting] = useState(false);

  const companyName = (companyId?: string) =>
    companyId ? companies.find((c) => c.id === companyId)?.name : undefined;

  const visible = useMemo(() => {
    const filtered =
      statusFilter === STATUS_FILTER_ALL ? ideas : ideas.filter((i) => i.status === statusFilter);
    const sorted = [...filtered];
    if (sort === "votes") {
      sorted.sort((a, b) => b.votes - a.votes || b.createdAt - a.createdAt);
    } else if (sort === "priority") {
      sorted.sort((a, b) => {
        const sa = priorityScore(a);
        const sb = priorityScore(b);
        if (sa === undefined && sb === undefined) return b.createdAt - a.createdAt;
        if (sa === undefined) return 1;
        if (sb === undefined) return -1;
        return sb - sa || b.createdAt - a.createdAt;
      });
    } else {
      sorted.sort((a, b) => b.createdAt - a.createdAt);
    }
    return sorted;
  }, [ideas, statusFilter, sort]);

  async function handleUpvote(id: string) {
    if (!workspace) return;
    await upvoteIdea(workspace.id, id);
  }

  async function handleStatusChange(id: string, status: IdeaStatus) {
    if (!workspace) return;
    await setIdeaStatus(workspace.id, id, status);
  }

  async function handleDelete(idea: Idea) {
    if (!workspace) return;
    if (!(await confirm(`Delete "${idea.title}"? This can't be undone.`))) return;
    try {
      await deleteIdea(workspace.id, idea.id);
      toast.success(`${idea.title} deleted`);
    } catch {
      toast.error("Couldn't delete the idea. Try again.");
    }
  }

  function startConvert(idea: Idea, type: "task" | "project") {
    if (idea.companyId) {
      void doConvert(idea, type, idea.companyId);
    } else {
      setConvertCompanyId("");
      setConvertTarget({ idea, type });
    }
  }

  async function doConvert(idea: Idea, type: "task" | "project", companyId: string) {
    if (!workspace) return;
    setConverting(true);
    try {
      const description = idea.description || undefined;
      const ref =
        type === "task"
          ? await createTask(workspace.id, {
              companyId,
              title: idea.title,
              description,
              priority: "medium",
              status: "not_started",
            })
          : await createProject(workspace.id, {
              companyId,
              name: idea.title,
              description,
              priority: "medium",
              status: "not_started",
            });
      await updateIdea(workspace.id, idea.id, { convertedTo: { type, id: ref.id } });
      toast.success(`Converted to ${type}`);
      setConvertTarget(null);
    } catch {
      toast.error(`Couldn't convert to ${type}. Try again.`);
    } finally {
      setConverting(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Ideas"
        description={`${ideas.length} idea${ideas.length === 1 ? "" : "s"} captured`}
        actions={
          <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
            <Plus className="size-4" />
            New idea
          </Button>
        }
      />

      <div className="flex-1 p-4 lg:p-6">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? STATUS_FILTER_ALL)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All statuses">
                {(v: string) => (v === STATUS_FILTER_ALL ? "All statuses" : IDEA_STATUS_LABELS[v as IdeaStatus])}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={STATUS_FILTER_ALL}>All statuses</SelectItem>
              {IDEA_STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sort} onValueChange={(v) => setSort((v as SortMode) ?? "votes")}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Sort">
                {(v: SortMode) => (v === "votes" ? "Top voted" : v === "priority" ? "Priority" : "Newest")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="votes">Top voted</SelectItem>
              <SelectItem value="priority">Priority</SelectItem>
              <SelectItem value="newest">Newest</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-40 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={Lightbulb}
            title={ideas.length === 0 ? "No ideas yet" : "No ideas match this filter"}
            description={
              ideas.length === 0
                ? "Capture product, marketing, and business ideas before they slip - triage them by status and vote on the ones worth pursuing."
                : "Try a different status filter to see more ideas."
            }
            action={
              ideas.length === 0 ? (
                <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
                  <Plus className="size-4" />
                  New idea
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((idea, i) => (
              <motion.div
                key={idea.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: i * 0.03 }}
                className="group relative flex flex-col rounded-xl border border-border bg-card p-5 transition-colors hover:border-border-hover"
              >
                <div className="absolute left-3 top-3 opacity-0 transition-opacity group-hover:opacity-100">
                  <DropdownMenu>
                    <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="size-7" aria-label="Idea actions" />}>
                      <MoreHorizontal className="size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem onClick={() => setEditingIdea(idea)}>
                        <Pencil className="size-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => startConvert(idea, "task")}>
                        Convert to task
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => startConvert(idea, "project")}>
                        Convert to project
                      </DropdownMenuItem>
                      <DropdownMenuItem variant="destructive" onClick={() => handleDelete(idea)}>
                        <Trash2 className="size-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 pl-8">
                    <p className="truncate text-sm font-semibold">{idea.title}</p>
                    {(companyName(idea.companyId) || idea.createdAt) && (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {companyName(idea.companyId) ?? "General"} · {formatDate(idea.createdAt)}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleUpvote(idea.id)}
                    className="flex shrink-0 flex-col items-center gap-0.5 rounded-lg border border-border bg-secondary px-2.5 py-1.5 text-primary transition-colors hover:bg-secondary/70"
                  >
                    <ArrowBigUp className="size-4" />
                    <span className="text-xs font-semibold text-foreground">{idea.votes}</span>
                  </button>
                </div>

                {idea.description && (
                  <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{idea.description}</p>
                )}

                {(idea.impact !== undefined || idea.effort !== undefined) && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    {idea.impact !== undefined && `Impact ${idea.impact}`}
                    {idea.impact !== undefined && idea.effort !== undefined && " · "}
                    {idea.effort !== undefined && `Effort ${idea.effort}`}
                  </p>
                )}

                {idea.tags && idea.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {idea.tags.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}

                {idea.convertedTo && (
                  <p className="mt-3 text-xs">
                    {idea.convertedTo.type === "project" ? (
                      <Link href={`/projects/${idea.convertedTo.id}`} className="font-medium text-primary hover:underline">
                        → View project
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">→ Converted to a task</span>
                    )}
                  </p>
                )}

                <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3">
                  <span
                    className={cn(
                      "inline-flex w-fit items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium",
                      IDEA_STATUS_STYLES[idea.status]
                    )}
                  >
                    {IDEA_STATUS_LABELS[idea.status]}
                  </span>
                  <Select
                    value={idea.status}
                    onValueChange={(v) => v && handleStatusChange(idea.id, v as IdeaStatus)}
                  >
                    <SelectTrigger size="sm" className="w-32">
                      <SelectValue>{(v: IdeaStatus) => IDEA_STATUS_LABELS[v]}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {IDEA_STATUSES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <IdeaFormDialog open={createOpen} onOpenChange={setCreateOpen} />
      <IdeaFormDialog
        open={Boolean(editingIdea)}
        onOpenChange={(v) => !v && setEditingIdea(null)}
        idea={editingIdea}
      />

      <Dialog open={Boolean(convertTarget)} onOpenChange={(v) => !v && setConvertTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Pick a company</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This idea isn&apos;t tied to a company yet - pick one to convert it to a{" "}
            {convertTarget?.type ?? "task"}.
          </p>
          <Select value={convertCompanyId} onValueChange={(v) => setConvertCompanyId(v ?? "")}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select company">
                {(v: string) => companies.find((c) => c.id === v)?.name ?? "Select company"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {companies.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setConvertTarget(null)}>
              Cancel
            </Button>
            <Button
              disabled={!convertCompanyId || converting}
              onClick={() => convertTarget && doConvert(convertTarget.idea, convertTarget.type, convertCompanyId)}
            >
              {converting ? "Converting…" : "Convert"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

"use client";

import { motion } from "framer-motion";
import { ArrowBigUp, Lightbulb, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { setIdeaStatus, upvoteIdea, useIdeas } from "@/lib/data/ideas";
import { useCompanies } from "@/lib/data/companies";
import { formatDate } from "@/lib/format";
import { IDEA_STATUSES, type IdeaStatus } from "@/lib/types";
import { useWorkspace } from "@/lib/workspace/workspace-provider";
import { cn } from "@/lib/utils";

const IDEA_STATUS_STYLES: Record<IdeaStatus, string> = {
  new: "bg-primary/10 text-primary",
  considering: "bg-analytics-purple/10 text-analytics-purple",
  planned: "bg-analytics-purple/10 text-analytics-purple",
  in_progress: "bg-warning/10 text-warning",
  shipped: "bg-success/10 text-success",
  rejected: "bg-danger/10 text-danger",
};

const IDEA_STATUS_LABELS: Record<IdeaStatus, string> = Object.fromEntries(
  IDEA_STATUSES.map((s) => [s.value, s.label])
) as Record<IdeaStatus, string>;

const STATUS_FILTER_ALL = "all";
type SortMode = "votes" | "newest";

export default function IdeasPage() {
  const { workspace } = useWorkspace();
  const { data: ideas, loading } = useIdeas(workspace?.id ?? null);
  const { data: companies } = useCompanies(workspace?.id ?? null);
  const [createOpen, setCreateOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>(STATUS_FILTER_ALL);
  const [sort, setSort] = useState<SortMode>("votes");

  const companyName = (companyId?: string) =>
    companyId ? companies.find((c) => c.id === companyId)?.name : undefined;

  const visible = useMemo(() => {
    const filtered =
      statusFilter === STATUS_FILTER_ALL ? ideas : ideas.filter((i) => i.status === statusFilter);
    const sorted = [...filtered];
    if (sort === "votes") {
      sorted.sort((a, b) => b.votes - a.votes || b.createdAt - a.createdAt);
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
                {(v: SortMode) => (v === "votes" ? "Top voted" : "Newest")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="votes">Top voted</SelectItem>
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
                className="flex flex-col rounded-xl border border-border bg-card p-5 transition-colors hover:border-white/15"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
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

                {idea.tags && idea.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {idea.tags.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
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
    </>
  );
}

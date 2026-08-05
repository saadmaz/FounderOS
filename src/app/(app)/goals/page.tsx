"use client";

import { motion } from "framer-motion";
import { Building2, MoreHorizontal, Pencil, Plus, Target, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { GoalFormDialog } from "@/components/goals/goal-form-dialog";
import { useCompanies } from "@/lib/data/companies";
import { deleteGoal, updateGoal, useGoals } from "@/lib/data/goals";
import { formatDate } from "@/lib/format";
import { GOAL_CATEGORIES, GOAL_STATUSES, type Goal, type GoalCategory, type GoalStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/lib/workspace/workspace-provider";

const CATEGORY_STYLES: Record<GoalCategory, string> = {
  revenue: "bg-success/10 text-success",
  growth: "bg-primary/10 text-primary",
  product: "bg-analytics-purple/10 text-analytics-purple",
  personal: "bg-analytics-cyan/10 text-analytics-cyan",
  other: "bg-muted text-muted-foreground",
};

const CATEGORY_LABELS: Record<GoalCategory, string> = Object.fromEntries(
  GOAL_CATEGORIES.map((c) => [c.value, c.label])
) as Record<GoalCategory, string>;

const GOAL_STATUS_STYLES: Record<GoalStatus, string> = {
  not_started: "bg-muted text-muted-foreground",
  in_progress: "bg-primary/10 text-primary",
  completed: "bg-success/10 text-success",
  missed: "bg-danger/10 text-danger",
};

const GOAL_STATUS_LABELS: Record<GoalStatus, string> = Object.fromEntries(
  GOAL_STATUSES.map((s) => [s.value, s.label])
) as Record<GoalStatus, string>;

const ALL = "all";

function GoalCategoryBadge({ category }: { category: GoalCategory }) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium",
        CATEGORY_STYLES[category]
      )}
    >
      {CATEGORY_LABELS[category] ?? category}
    </span>
  );
}

function GoalStatusBadge({ status }: { status: GoalStatus }) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium",
        GOAL_STATUS_STYLES[status]
      )}
    >
      {GOAL_STATUS_LABELS[status] ?? status}
    </span>
  );
}

function progressPercent(goal: Goal) {
  if (typeof goal.targetValue === "number" && goal.targetValue > 0) {
    const current = goal.currentValue ?? 0;
    return Math.min(100, Math.max(0, (current / goal.targetValue) * 100));
  }
  return goal.status === "completed" ? 100 : 0;
}

export default function GoalsPage() {
  const { workspace, role } = useWorkspace();
  const { data: goals, loading } = useGoals(workspace?.id ?? null);
  const { data: companies } = useCompanies(workspace?.id ?? null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>(ALL);
  const [statusFilter, setStatusFilter] = useState<string>(ALL);

  const canEdit = role === "owner" || role === "admin" || role === "manager";
  const now = new Date().getTime();

  const companyName = useMemo(() => {
    const map = new Map(companies.map((c) => [c.id, c.name]));
    return (companyId?: string) => (companyId ? (map.get(companyId) ?? "Unknown company") : null);
  }, [companies]);

  const filtered = useMemo(() => {
    return goals.filter((g) => {
      if (categoryFilter !== ALL && g.category !== categoryFilter) return false;
      if (statusFilter !== ALL && g.status !== statusFilter) return false;
      return true;
    });
  }, [goals, categoryFilter, statusFilter]);

  async function handleDelete(goal: Goal) {
    if (!workspace) return;
    try {
      await deleteGoal(workspace.id, goal.id);
      toast.success(`${goal.title} deleted`);
    } catch {
      toast.error("Couldn't delete the goal. Try again.");
    }
  }

  async function nudgeProgress(goal: Goal, direction: 1 | -1) {
    if (!workspace || typeof goal.targetValue !== "number" || goal.targetValue <= 0) return;
    const step = Math.max(1, Math.round(goal.targetValue / 20));
    const next = Math.max(0, (goal.currentValue ?? 0) + direction * step);
    try {
      await updateGoal(workspace.id, goal.id, { currentValue: next });
    } catch {
      toast.error("Couldn't update progress.");
    }
  }

  return (
    <>
      <PageHeader
        title="Goals"
        description={`${filtered.length} goal${filtered.length === 1 ? "" : "s"}`}
        actions={
          canEdit ? (
            <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
              <Plus className="size-4" />
              New goal
            </Button>
          ) : undefined
        }
      />

      <div className="flex-1 p-4 lg:p-6">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v ?? ALL)}>
            <SelectTrigger size="sm" className="w-40">
              <SelectValue>
                {(v: string) => (v === ALL ? "All categories" : (CATEGORY_LABELS[v as GoalCategory] ?? v))}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All categories</SelectItem>
              {GOAL_CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? ALL)}>
            <SelectTrigger size="sm" className="w-40">
              <SelectValue>
                {(v: string) => (v === ALL ? "All statuses" : (GOAL_STATUS_LABELS[v as GoalStatus] ?? v))}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              {GOAL_STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-40 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Target}
            title={goals.length === 0 ? "No goals yet" : "No goals match your filters"}
            description={
              goals.length === 0
                ? "Set a goal to track progress toward what matters most, workspace-wide or for a specific company."
                : "Try a different category or status filter."
            }
            action={
              canEdit && goals.length === 0 ? (
                <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
                  <Plus className="size-4" />
                  New goal
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((g, i) => {
              const percent = progressPercent(g);
              const hasTarget = typeof g.targetValue === "number" && g.targetValue > 0;
              const overdue = Boolean(g.targetDate) && g.targetDate! < now && g.status !== "completed";
              const company = companyName(g.companyId);
              return (
                <motion.div
                  key={g.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: i * 0.03 }}
                  className="group relative flex flex-col rounded-xl border border-border bg-card p-5 transition-colors hover:border-white/15"
                >
                  {canEdit && (
                    <div className="absolute right-3 top-3 opacity-0 transition-opacity group-hover:opacity-100">
                      <DropdownMenu>
                        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="size-7" />}>
                          <MoreHorizontal className="size-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditingGoal(g)}>
                            <Pencil className="size-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem variant="destructive" onClick={() => handleDelete(g)}>
                            <Trash2 className="size-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}

                  <div className="min-w-0 pr-8">
                    <p className="truncate text-sm font-semibold">{g.title}</p>
                    {g.description && (
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{g.description}</p>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <GoalCategoryBadge category={g.category} />
                    <GoalStatusBadge status={g.status} />
                    {company && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                        <Building2 className="size-3" />
                        {company}
                      </span>
                    )}
                  </div>

                  <div className="mt-4 flex-1">
                    {hasTarget ? (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">
                            {(g.currentValue ?? 0).toLocaleString()}
                            {g.unit && g.unit.length <= 2 ? g.unit : ""} / {g.targetValue!.toLocaleString()}
                            {g.unit && g.unit.length <= 2 ? g.unit : g.unit ? ` ${g.unit}` : ""}
                          </span>
                          <span className="font-medium text-foreground">{Math.round(percent)}%</span>
                        </div>
                        <Progress value={percent} />
                        {canEdit && (
                          <div className="flex items-center gap-1.5 pt-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon-xs"
                              onClick={() => nudgeProgress(g, -1)}
                            >
                              −
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon-xs"
                              onClick={() => nudgeProgress(g, 1)}
                            >
                              +
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="xs"
                              onClick={() => setEditingGoal(g)}
                            >
                              Update progress
                            </Button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">No target value set</p>
                    )}
                  </div>

                  {g.targetDate && (
                    <div className="mt-3 border-t border-border pt-3 text-xs">
                      <span className={overdue ? "font-medium text-danger" : "text-muted-foreground"}>
                        {overdue ? "Overdue — was due" : "Due"} {formatDate(g.targetDate)}
                      </span>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      <GoalFormDialog open={createOpen} onOpenChange={setCreateOpen} />
      <GoalFormDialog
        open={Boolean(editingGoal)}
        onOpenChange={(v) => !v && setEditingGoal(null)}
        goal={editingGoal}
      />
    </>
  );
}

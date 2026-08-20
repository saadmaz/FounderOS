"use client";

import { motion } from "framer-motion";
import { Building2, MoreHorizontal, Pencil, Plus, Target, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip } from "recharts";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { useConfirm } from "@/lib/confirm/confirm-provider";
import { useCompanies } from "@/lib/data/companies";
import { useGoalProgress, recordProgressSnapshot } from "@/lib/data/goal-progress";
import { deleteGoal, deriveGoalStatus, updateGoal, useGoals } from "@/lib/data/goals";
import { useProjects } from "@/lib/data/projects";
import { useTasks } from "@/lib/data/tasks";
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

/** Inline sparkline of a goal's progress over time - no axes, this is meant
 * to fit in a card footprint, not read as a standalone chart. Renders
 * nothing until there are at least 2 points to draw a line between. */
function GoalTrendSparkline({ workspaceId, goalId }: { workspaceId: string; goalId: string }) {
  const { data: history } = useGoalProgress(workspaceId, goalId);
  const gradientId = `goal-trend-${goalId}`;
  if (history.length < 2) return null;
  const points = history.map((h) => ({ date: formatDate(h.recordedAt), value: h.value }));
  return (
    <div className="mt-1.5 h-10">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 2, right: 2, bottom: 0, left: 2 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.3} />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <Tooltip
            contentStyle={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              fontSize: "11px",
              padding: "4px 8px",
            }}
            labelFormatter={() => ""}
            formatter={(value) => [value, "Value"]}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="var(--primary)"
            strokeWidth={1.5}
            fill={`url(#${gradientId})`}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Small numeric input + "Set" button for typing an exact progress value,
 * next to the +/- nudge buttons which only move by a ~5%-of-target step. */
function GoalExactProgressInput({ goal, onSet }: { goal: Goal; onSet: (value: number) => void }) {
  const [draft, setDraft] = useState(String(goal.currentValue ?? 0));
  // Re-sync the draft when currentValue changes elsewhere (nudge buttons,
  // the edit dialog) - React's documented render-time pattern for this
  // (same one used in settings/page.tsx for the workspace-name draft)
  // rather than an effect, which would cause an extra render on every sync.
  const [syncedValue, setSyncedValue] = useState(goal.currentValue);
  if (goal.currentValue !== syncedValue) {
    setSyncedValue(goal.currentValue);
    setDraft(String(goal.currentValue ?? 0));
  }

  function commit() {
    const value = Number(draft);
    if (Number.isNaN(value)) return;
    onSet(value);
  }

  return (
    <div className="flex items-center gap-1">
      <Input
        type="number"
        step="any"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
        }}
        className="h-7 w-20 text-xs"
      />
      <Button type="button" variant="outline" size="xs" onClick={commit}>
        Set
      </Button>
    </div>
  );
}

export default function GoalsPage() {
  const { workspace, role } = useWorkspace();
  const confirm = useConfirm();
  const { data: goals, loading } = useGoals(workspace?.id ?? null);
  const { data: companies } = useCompanies(workspace?.id ?? null);
  const { data: allTasks } = useTasks(workspace?.id ?? null);
  const { data: allProjects } = useProjects(workspace?.id ?? null);
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

  const taskById = useMemo(() => new Map(allTasks.map((t) => [t.id, t])), [allTasks]);
  const projectById = useMemo(() => new Map(allProjects.map((p) => [p.id, p])), [allProjects]);

  const filtered = useMemo(() => {
    return goals.filter((g) => {
      if (categoryFilter !== ALL && g.category !== categoryFilter) return false;
      if (statusFilter !== ALL && g.status !== statusFilter) return false;
      return true;
    });
  }, [goals, categoryFilter, statusFilter]);

  async function handleDelete(goal: Goal) {
    if (!workspace) return;
    if (!(await confirm(`Delete "${goal.title}"? This can't be undone.`))) return;
    try {
      await deleteGoal(workspace.id, goal.id);
      toast.success(`${goal.title} deleted`);
    } catch {
      toast.error("Couldn't delete the goal. Try again.");
    }
  }

  async function applyProgress(goal: Goal, next: number) {
    if (!workspace) return;
    try {
      await updateGoal(workspace.id, goal.id, {
        currentValue: next,
        status: deriveGoalStatus(next, goal.targetValue, goal.status),
      });
      await recordProgressSnapshot(workspace.id, goal.id, next);
    } catch {
      toast.error("Couldn't update progress.");
    }
  }

  function nudgeProgress(goal: Goal, direction: 1 | -1) {
    if (typeof goal.targetValue !== "number" || goal.targetValue <= 0) return;
    const step = Math.max(1, Math.round(goal.targetValue / 20));
    const next = Math.max(0, (goal.currentValue ?? 0) + direction * step);
    void applyProgress(goal, next);
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
                  className={cn(
                    "group relative flex flex-col rounded-xl border bg-card p-5 transition-colors",
                    g.status === "completed"
                      ? "border-success/30 bg-success/[0.03] hover:border-success/40"
                      : overdue
                        ? "border-danger/30 bg-danger/[0.03] hover:border-danger/40"
                        : "border-border hover:border-border-hover"
                  )}
                >
                  {canEdit && (
                    <div className="absolute right-3 top-3 opacity-0 transition-opacity group-hover:opacity-100">
                      <DropdownMenu>
                        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="size-7" aria-label="Goal actions" />}>
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
                        {workspace && <GoalTrendSparkline workspaceId={workspace.id} goalId={g.id} />}
                        {canEdit && (
                          <div className="flex flex-wrap items-center gap-1.5 pt-1">
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
                            <GoalExactProgressInput goal={g} onSet={(value) => applyProgress(g, value)} />
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">No target value set</p>
                    )}
                  </div>

                  {(g.linkedTaskIds?.length || g.linkedProjectIds?.length) ? (
                    <div className="mt-3 space-y-1 border-t border-border pt-3">
                      {g.linkedTaskIds && g.linkedTaskIds.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {g.linkedTaskIds.filter((id) => taskById.get(id)?.status === "completed").length}/
                          {g.linkedTaskIds.length} linked tasks done
                        </p>
                      )}
                      <div className="flex flex-wrap gap-1.5">
                        {g.linkedTaskIds?.map((id) => {
                          const t = taskById.get(id);
                          if (!t) return null;
                          return (
                            <span
                              key={id}
                              className="truncate rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground"
                            >
                              {t.title}
                            </span>
                          );
                        })}
                        {g.linkedProjectIds?.map((id) => {
                          const p = projectById.get(id);
                          if (!p) return null;
                          return (
                            <Link
                              key={id}
                              href={`/projects/${id}`}
                              className="truncate rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-primary hover:underline"
                            >
                              {p.name}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

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

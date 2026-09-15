"use client";

import { Clock, ListChecks, Pencil, Repeat, Target, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { PriorityBadge, STATUS_DOT_COLOR, STATUS_STYLES } from "@/components/shared/status-badge";
import { StatCard } from "@/components/shared/stat-card";
import { SectionLabel } from "@/components/crm/section-label";
import { useConfirm } from "@/lib/confirm/confirm-provider";
import { useMembers } from "@/lib/data/members";
import { deleteTask, deleteTaskSeries, setTaskStatus, updateTask } from "@/lib/data/tasks";
import { useTimeEntries } from "@/lib/data/time-entries";
import { formatDate, formatHours, initials, sumHours } from "@/lib/format";
import { taskStatusLabel } from "@/lib/labels";
import { recurrenceSummary } from "@/lib/recurrence";
import { TASK_STATUSES, type Company, type Task, type TaskStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Read-only view of a task, opened by clicking it in the table or board -
 * editing is a deliberate second step (the Edit button below) rather than
 * the click target itself, so a stray click doesn't drop you straight into
 * a form. Subtasks are the one thing still directly interactive here, since
 * ticking a step off doesn't need the full edit form.
 */
export function TaskDetailSheet({
  open,
  onOpenChange,
  task,
  companies,
  workspaceId,
  onEdit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  task: Task | null;
  companies: Company[];
  workspaceId: string;
  onEdit?: (task: Task) => void;
}) {
  const confirm = useConfirm();
  const { data: members } = useMembers(workspaceId);
  const { data: timeEntries } = useTimeEntries(workspaceId);

  if (!task) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full p-0 sm:max-w-md" />
      </Sheet>
    );
  }

  const company = companies.find((c) => c.id === task.companyId);
  const owner = task.ownerId ? members.find((m) => m.id === task.ownerId) : undefined;
  const today = new Date().setHours(0, 0, 0, 0);
  const overdue = task.dueDate && task.dueDate < today && task.status !== "completed";
  // Real time actually logged against this task (timer/manual entries with
  // this taskId) - distinct from estimatedMinutes, which is a plan, not a
  // record of what happened.
  const actualHours = sumHours(timeEntries.filter((e) => e.taskId === task.id));

  async function toggleSubtask(subtaskId: string) {
    if (!task?.subtasks) return;
    await updateTask(workspaceId, task.id, {
      subtasks: task.subtasks.map((s) => (s.id === subtaskId ? { ...s, done: !s.done } : s)),
    });
  }

  async function handleDelete() {
    if (!task) return;
    if (!(await confirm(`Delete "${task.title}"? This can't be undone.`))) return;
    await deleteTask(workspaceId, task.id);
    toast.success("Task deleted");
    onOpenChange(false);
  }

  async function handleDeleteSeries() {
    if (!task?.recurrence) return;
    if (
      !(await confirm(
        `Delete all ${task.recurrence.count} tasks in "${task.title}"'s series? This can't be undone.`
      ))
    )
      return;
    await deleteTaskSeries(workspaceId, task.recurrence.groupId);
    toast.success("Series deleted");
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        {/* Header */}
        <div className="space-y-3 border-b border-border p-4 lg:p-5">
          <div className="flex items-center gap-1.5 pr-8 text-xs text-muted-foreground">
            {company && (
              <span className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full" style={{ backgroundColor: company.color }} />
                {company.name}
              </span>
            )}
          </div>

          <h2
            className={cn(
              "pr-6 text-lg font-semibold leading-snug",
              task.status === "completed" && "text-muted-foreground line-through"
            )}
          >
            {task.title}
          </h2>

          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={task.status}
              onValueChange={(v) => v && setTaskStatus(workspaceId, task.id, v as TaskStatus)}
            >
              <SelectTrigger
                size="sm"
                className={cn("h-7 w-fit gap-1.5 rounded-full border-none px-2.5 shadow-none", STATUS_STYLES[task.status])}
              >
                <SelectValue>
                  {() => (
                    <>
                      <span className="size-1.5 shrink-0 rounded-full bg-current" />
                      {taskStatusLabel(task.status)}
                    </>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {TASK_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    <span className={cn("size-1.5 shrink-0 rounded-full", STATUS_DOT_COLOR[s.value])} />
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <PriorityBadge priority={task.priority} />
          </div>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 lg:p-5">
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label="Actual hours"
              value={formatHours(actualHours)}
              icon={Clock}
              accent="text-analytics-pink"
              accentBg="bg-analytics-pink/10"
            />
            <StatCard
              label="Estimated"
              value={
                task.isOffHours && task.estimatedMinutes !== undefined
                  ? formatHours(task.estimatedMinutes / 60)
                  : "—"
              }
              icon={Target}
              accent="text-analytics-cyan"
              accentBg="bg-analytics-cyan/10"
            />
          </div>

          <div className="grid grid-cols-2 gap-x-3 gap-y-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground-2">Due date</p>
              <p className={cn(overdue && "font-medium text-danger")}>{formatDate(task.dueDate)}</p>
            </div>
            {task.workDate && (
              <div>
                <p className="text-xs text-muted-foreground-2">Work date</p>
                <p>{formatDate(task.workDate)}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground-2">Assignee</p>
              {owner ? (
                <span className="flex items-center gap-1.5">
                  <Avatar size="sm" className="size-5">
                    <AvatarImage src={owner.photoURL} />
                    <AvatarFallback className="text-[9px]">{initials(owner.displayName)}</AvatarFallback>
                  </Avatar>
                  {owner.displayName}
                </span>
              ) : (
                <p>Unassigned</p>
              )}
            </div>
            {task.estimatedMinutes !== undefined && (
              <div>
                <p className="text-xs text-muted-foreground-2">Time estimate</p>
                <p>
                  {task.estimatedMinutes} min
                  <span className="text-muted-foreground-2"> · {task.isOffHours ? "Off hours (billable)" : "Office hours"}</span>
                </p>
              </div>
            )}
            {task.recurrence && (
              <div>
                <p className="text-xs text-muted-foreground-2">Repeats</p>
                <p className="flex items-center gap-1">
                  <Repeat className="size-3" />
                  {recurrenceSummary(task.recurrence.frequency, task.recurrence.interval)}
                </p>
              </div>
            )}
          </div>

          {task.tags && task.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {task.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {task.description && (
            <div>
              <SectionLabel>Description</SectionLabel>
              <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{task.description}</p>
            </div>
          )}

          {task.subtasks && task.subtasks.length > 0 && (
            <div>
              <SectionLabel>
                <span className="flex items-center gap-1.5 normal-case">
                  <ListChecks className="size-3" />
                  Subtasks · {task.subtasks.filter((s) => s.done).length}/{task.subtasks.length}
                </span>
              </SectionLabel>
              <div className="mt-2 space-y-1">
                {task.subtasks.map((s) => (
                  <label
                    key={s.id}
                    className="flex items-center gap-2 rounded-md px-1 py-1 hover:bg-secondary/40"
                  >
                    <Checkbox checked={s.done} onCheckedChange={() => toggleSubtask(s.id)} />
                    <span className={cn("text-sm", s.done && "text-muted-foreground line-through")}>
                      {s.title}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 border-t border-border p-4 lg:p-5">
          {onEdit && (
            <Button className="flex-1 gap-1.5" onClick={() => onEdit(task)}>
              <Pencil className="size-3.5" />
              Edit task
            </Button>
          )}
          <Button
            variant="outline"
            className="gap-1.5 text-danger hover:bg-danger/10 hover:text-danger"
            onClick={handleDelete}
          >
            <Trash2 className="size-3.5" />
            {task.recurrence ? "Delete this" : "Delete"}
          </Button>
          {task.recurrence && (
            <Button
              variant="outline"
              className="gap-1.5 text-danger hover:bg-danger/10 hover:text-danger"
              onClick={handleDeleteSeries}
            >
              <Trash2 className="size-3.5" />
              Delete series
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

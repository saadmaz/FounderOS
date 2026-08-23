"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
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
import { useCompanies } from "@/lib/data/companies";
import { omitUndefined } from "@/lib/data/firestore-helpers";
import { useMembers } from "@/lib/data/members";
import { useProjects } from "@/lib/data/projects";
import { createRecurringTasks, createTask, updateTask } from "@/lib/data/tasks";
import { toDateInputValue } from "@/lib/format";
import { priorityLabel, taskStatusLabel } from "@/lib/labels";
import { expandRecurrence, MAX_RECURRENCE_INSTANCES } from "@/lib/recurrence";
import { PRIORITIES, RECURRENCE_FREQUENCIES, TASK_STATUSES, type Subtask, type Task } from "@/lib/types";
import { useWorkspace } from "@/lib/workspace/workspace-provider";

const NO_OWNER = "unassigned";

const RECURRENCE_UNIT: Record<"daily" | "weekly" | "monthly", string> = {
  daily: "day(s)",
  weekly: "week(s)",
  monthly: "month(s)",
};

const schema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  companyId: z.string().min(1, "Pick a company"),
  projectId: z.string().optional(),
  priority: z.enum(["critical", "high", "medium", "low"]),
  status: z.enum(["not_started", "in_progress", "blocked", "in_review", "completed", "cancelled"]),
  dueDate: z.string().optional(),
  description: z.string().optional(),
  ownerId: z.string().optional(),
  estimatedHours: z.string().optional(),
  tags: z.string().optional(),
  subtasks: z.array(z.object({ id: z.string(), title: z.string(), done: z.boolean() })),
  recurrenceFreq: z.enum(["none", "daily", "weekly", "monthly"]),
  recurrenceInterval: z.string(),
  recurrenceEndMode: z.enum(["count", "until"]),
  recurrenceCount: z.string(),
  recurrenceUntil: z.string(),
});

type FormValues = z.infer<typeof schema>;

const RECURRENCE_DEFAULTS = {
  recurrenceFreq: "none" as const,
  recurrenceInterval: "1",
  recurrenceEndMode: "count" as const,
  recurrenceCount: "5",
  recurrenceUntil: "",
};

function defaultsFor(task?: Task | null, defaultCompanyId?: string, defaultDescription?: string): FormValues {
  if (task) {
    return {
      title: task.title,
      companyId: task.companyId,
      projectId: task.projectId ?? "",
      priority: task.priority,
      status: task.status,
      dueDate: task.dueDate ? toDateInputValue(task.dueDate) : "",
      description: task.description ?? "",
      ownerId: task.ownerId ?? NO_OWNER,
      estimatedHours: task.estimatedHours !== undefined ? String(task.estimatedHours) : "",
      tags: task.tags && task.tags.length > 0 ? task.tags.join(", ") : "",
      subtasks: task.subtasks ?? [],
      // Recurrence is a create-time-only decision (see the Repeat field
      // below, hidden entirely while editing) - always reset to "none"
      // here regardless of whether this task belongs to a series.
      ...RECURRENCE_DEFAULTS,
    };
  }
  return {
    title: "",
    companyId: defaultCompanyId ?? "",
    projectId: "",
    priority: "medium",
    status: "not_started",
    dueDate: "",
    description: defaultDescription ?? "",
    ownerId: NO_OWNER,
    estimatedHours: "",
    tags: "",
    subtasks: [],
    ...RECURRENCE_DEFAULTS,
  };
}

export function TaskFormDialog({
  open,
  onOpenChange,
  defaultCompanyId,
  defaultDescription,
  task,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultCompanyId?: string;
  /** Prefills the description field when creating - e.g. a "Follow-up from
   * meeting: ..." note when creating a task from a meeting. Ignored when
   * editing an existing task. */
  defaultDescription?: string;
  task?: Task | null;
}) {
  const { workspace } = useWorkspace();
  const { data: companies } = useCompanies(workspace?.id ?? null);
  const { data: members } = useMembers(workspace?.id ?? null);
  const [submitting, setSubmitting] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const isEditing = Boolean(task);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultsFor(task, defaultCompanyId, defaultDescription),
  });

  useEffect(() => {
    if (!open) return;
    reset(defaultsFor(task, defaultCompanyId, defaultDescription));
    setNewSubtaskTitle("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, task]);

  const companyId = watch("companyId");
  const { data: projects } = useProjects(workspace?.id ?? null, companyId || undefined);
  const subtasks = watch("subtasks");
  const recurrenceFreq = watch("recurrenceFreq");
  const recurrenceEndMode = watch("recurrenceEndMode");

  function addSubtask() {
    const title = newSubtaskTitle.trim();
    if (!title) return;
    const newItem: Subtask = { id: crypto.randomUUID(), title, done: false };
    setValue("subtasks", [...subtasks, newItem]);
    setNewSubtaskTitle("");
  }

  function toggleSubtask(id: string) {
    setValue(
      "subtasks",
      subtasks.map((s) => (s.id === id ? { ...s, done: !s.done } : s))
    );
  }

  function removeSubtask(id: string) {
    setValue(
      "subtasks",
      subtasks.filter((s) => s.id !== id)
    );
  }

  async function onSubmit(values: FormValues) {
    if (!workspace) return;
    setSubmitting(true);
    try {
      const tags = values.tags
        ? values.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : undefined;
      const base = omitUndefined({
        companyId: values.companyId,
        projectId: values.projectId || undefined,
        title: values.title,
        description: values.description || undefined,
        status: values.status,
        priority: values.priority,
        ownerId: values.ownerId && values.ownerId !== NO_OWNER ? values.ownerId : undefined,
        estimatedHours: values.estimatedHours ? Number(values.estimatedHours) : undefined,
        tags: tags && tags.length > 0 ? tags : undefined,
        subtasks: values.subtasks.length > 0 ? values.subtasks : undefined,
      });

      if (isEditing && task) {
        await updateTask(workspace.id, task.id, {
          ...base,
          dueDate: values.dueDate ? new Date(`${values.dueDate}T00:00:00`).getTime() : null,
        });
        toast.success("Task updated");
      } else if (values.recurrenceFreq === "none") {
        await createTask(workspace.id, {
          ...base,
          dueDate: values.dueDate ? new Date(`${values.dueDate}T00:00:00`).getTime() : null,
        });
        toast.success("Task created");
      } else {
        const baseDate = values.dueDate ? new Date(`${values.dueDate}T00:00:00`).getTime() : Date.now();
        const dates = expandRecurrence(baseDate, {
          frequency: values.recurrenceFreq,
          interval: Number(values.recurrenceInterval) || 1,
          endMode: values.recurrenceEndMode,
          count: Number(values.recurrenceCount) || 1,
          until: values.recurrenceUntil
            ? new Date(`${values.recurrenceUntil}T23:59:59`).getTime()
            : undefined,
        });
        await createRecurringTasks(workspace.id, base, dates, {
          frequency: values.recurrenceFreq,
          interval: Number(values.recurrenceInterval) || 1,
        });
        toast.success(`${dates.length} tasks created`);
      }
      onOpenChange(false);
    } catch {
      toast.error(isEditing ? "Couldn't update the task. Try again." : "Couldn't create the task. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit task" : "New task"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input id="title" placeholder="What needs to happen?" autoFocus {...register("title")} />
            {errors.title && <p className="text-xs text-danger">{errors.title.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Company</Label>
              <Select value={companyId} onValueChange={(v) => setValue("companyId", v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select company">
                    {(v: string) => companies.find((c) => c.id === v)?.name ?? "Select company"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="flex items-center gap-2">
                        <span className="size-2 rounded-full" style={{ backgroundColor: c.color }} />
                        {c.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.companyId && <p className="text-xs text-danger">{errors.companyId.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Project (optional)</Label>
              <Select
                value={watch("projectId")}
                onValueChange={(v) => setValue("projectId", v ?? "")}
                disabled={!companyId}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="No project">
                    {(v: string) => projects.find((p) => p.id === v)?.name ?? "No project"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={watch("priority")} onValueChange={(v) => setValue("priority", v as FormValues["priority"])}>
                <SelectTrigger className="w-full">
                  <SelectValue>{(v: FormValues["priority"]) => priorityLabel(v)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={watch("status")} onValueChange={(v) => setValue("status", v as FormValues["status"])}>
                <SelectTrigger className="w-full">
                  <SelectValue>{(v: FormValues["status"]) => taskStatusLabel(v)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {TASK_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Due date</Label>
              <DatePicker value={watch("dueDate")} onChange={(v) => setValue("dueDate", v)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Assignee (optional)</Label>
              <Select value={watch("ownerId") ?? NO_OWNER} onValueChange={(v) => setValue("ownerId", v ?? NO_OWNER)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Unassigned">
                    {(v: string) =>
                      v === NO_OWNER ? "Unassigned" : (members.find((m) => m.id === v)?.displayName ?? "Unassigned")
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_OWNER}>Unassigned</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="estimatedHours">Estimated hours (optional)</Label>
              <Input id="estimatedHours" type="number" min={0} placeholder="4" {...register("estimatedHours")} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tags">Tags (optional, comma-separated)</Label>
            <Input id="tags" placeholder="urgent, client-facing" {...register("tags")} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea id="description" rows={3} {...register("description")} />
          </div>

          <div className="space-y-1.5">
            <Label>Subtasks (optional)</Label>
            {subtasks.length > 0 && (
              <div className="space-y-1 rounded-lg border border-border p-2">
                {subtasks.map((s) => (
                  <div key={s.id} className="flex items-center gap-2 rounded-md px-1 py-1">
                    <Checkbox checked={s.done} onCheckedChange={() => toggleSubtask(s.id)} />
                    <span className={s.done ? "flex-1 text-sm text-muted-foreground line-through" : "flex-1 text-sm"}>
                      {s.title}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeSubtask(s.id)}
                      className="text-muted-foreground-2 hover:text-danger"
                      aria-label="Remove subtask"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Input
                placeholder="Add a step…"
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addSubtask();
                  }
                }}
              />
              <Button type="button" variant="outline" size="icon" onClick={addSubtask} aria-label="Add subtask">
                <Plus className="size-4" />
              </Button>
            </div>
          </div>

          {!isEditing && (
            <div className="space-y-1.5">
              <Label>Repeat</Label>
              <Select
                value={recurrenceFreq}
                onValueChange={(v) =>
                  setValue("recurrenceFreq", (v as FormValues["recurrenceFreq"]) ?? "none")
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(v: FormValues["recurrenceFreq"]) =>
                      v === "none"
                        ? "Does not repeat"
                        : (RECURRENCE_FREQUENCIES.find((f) => f.value === v)?.label ?? v)
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Does not repeat</SelectItem>
                  {RECURRENCE_FREQUENCIES.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {recurrenceFreq !== "none" && (
                <div className="space-y-3 rounded-lg border border-border p-3">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Every</span>
                    <Input
                      type="number"
                      min={1}
                      className="w-16"
                      {...register("recurrenceInterval")}
                    />
                    <span className="text-muted-foreground">{RECURRENCE_UNIT[recurrenceFreq]}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Ends</span>
                    <Select
                      value={recurrenceEndMode}
                      onValueChange={(v) =>
                        setValue("recurrenceEndMode", (v as FormValues["recurrenceEndMode"]) ?? "count")
                      }
                    >
                      <SelectTrigger size="sm" className="w-28">
                        <SelectValue>{(v: string) => (v === "count" ? "After" : "On date")}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="count">After</SelectItem>
                        <SelectItem value="until">On date</SelectItem>
                      </SelectContent>
                    </Select>
                    {recurrenceEndMode === "count" ? (
                      <>
                        <Input
                          type="number"
                          min={1}
                          max={MAX_RECURRENCE_INSTANCES}
                          className="w-16"
                          {...register("recurrenceCount")}
                        />
                        <span className="text-muted-foreground">tasks</span>
                      </>
                    ) : (
                      <DatePicker
                        className="w-40"
                        value={watch("recurrenceUntil")}
                        onChange={(v) => setValue("recurrenceUntil", v)}
                      />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground-2">
                    Creates up to {MAX_RECURRENCE_INSTANCES} tasks in the series, starting from the due date above
                    (or today, if none is set).
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : isEditing ? "Save changes" : "Create task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

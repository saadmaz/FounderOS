"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
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
import { createTask, updateTask } from "@/lib/data/tasks";
import { priorityLabel, taskStatusLabel } from "@/lib/labels";
import { PRIORITIES, TASK_STATUSES, type Task } from "@/lib/types";
import { useWorkspace } from "@/lib/workspace/workspace-provider";

const NO_OWNER = "unassigned";

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
});

type FormValues = z.infer<typeof schema>;

function defaultsFor(task?: Task | null, defaultCompanyId?: string): FormValues {
  if (task) {
    return {
      title: task.title,
      companyId: task.companyId,
      projectId: task.projectId ?? "",
      priority: task.priority,
      status: task.status,
      dueDate: task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : "",
      description: task.description ?? "",
      ownerId: task.ownerId ?? NO_OWNER,
      estimatedHours: task.estimatedHours !== undefined ? String(task.estimatedHours) : "",
    };
  }
  return {
    title: "",
    companyId: defaultCompanyId ?? "",
    projectId: "",
    priority: "medium",
    status: "not_started",
    dueDate: "",
    description: "",
    ownerId: NO_OWNER,
    estimatedHours: "",
  };
}

export function TaskFormDialog({
  open,
  onOpenChange,
  defaultCompanyId,
  task,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultCompanyId?: string;
  task?: Task | null;
}) {
  const { workspace } = useWorkspace();
  const { data: companies } = useCompanies(workspace?.id ?? null);
  const { data: members } = useMembers(workspace?.id ?? null);
  const [submitting, setSubmitting] = useState(false);
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
    defaultValues: defaultsFor(task, defaultCompanyId),
  });

  useEffect(() => {
    if (!open) return;
    reset(defaultsFor(task, defaultCompanyId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, task]);

  const companyId = watch("companyId");
  const { data: projects } = useProjects(workspace?.id ?? null, companyId || undefined);

  async function onSubmit(values: FormValues) {
    if (!workspace) return;
    setSubmitting(true);
    try {
      const payload = omitUndefined({
        companyId: values.companyId,
        projectId: values.projectId || undefined,
        title: values.title,
        description: values.description || undefined,
        status: values.status,
        priority: values.priority,
        dueDate: values.dueDate ? new Date(values.dueDate).getTime() : null,
        ownerId: values.ownerId && values.ownerId !== NO_OWNER ? values.ownerId : undefined,
        estimatedHours: values.estimatedHours ? Number(values.estimatedHours) : undefined,
      });
      if (isEditing && task) {
        await updateTask(workspace.id, task.id, payload);
        toast.success("Task updated");
      } else {
        await createTask(workspace.id, payload);
        toast.success("Task created");
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
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea id="description" rows={3} {...register("description")} />
          </div>

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

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
import { Checkbox } from "@/components/ui/checkbox";
import { useCompanies } from "@/lib/data/companies";
import { omitUndefined } from "@/lib/data/firestore-helpers";
import { recordProgressSnapshot } from "@/lib/data/goal-progress";
import { createGoal, deriveGoalStatus, updateGoal } from "@/lib/data/goals";
import { useProjects } from "@/lib/data/projects";
import { useTasks } from "@/lib/data/tasks";
import { GOAL_CATEGORIES, GOAL_STATUSES, type Goal } from "@/lib/types";
import { useWorkspace } from "@/lib/workspace/workspace-provider";

const NO_COMPANY = "none";

const schema = z.object({
  title: z.string().min(1, "Title is required").max(150),
  description: z.string().optional(),
  category: z.enum(["revenue", "growth", "product", "personal", "other"]),
  status: z.enum(["not_started", "in_progress", "completed", "missed"]),
  companyId: z.string().optional(),
  targetValue: z.string().optional(),
  currentValue: z.string().optional(),
  unit: z.string().optional(),
  targetDate: z.string().optional(),
  linkedTaskIds: z.array(z.string()),
  linkedProjectIds: z.array(z.string()),
});

type FormValues = z.infer<typeof schema>;

function defaultsFor(goal?: Goal | null, defaultCompanyId?: string): FormValues {
  if (goal) {
    return {
      title: goal.title,
      description: goal.description ?? "",
      category: goal.category,
      status: goal.status,
      companyId: goal.companyId ?? NO_COMPANY,
      targetValue: goal.targetValue !== undefined ? String(goal.targetValue) : "",
      currentValue: goal.currentValue !== undefined ? String(goal.currentValue) : "",
      unit: goal.unit ?? "",
      targetDate: goal.targetDate ? new Date(goal.targetDate).toISOString().slice(0, 10) : "",
      linkedTaskIds: goal.linkedTaskIds ?? [],
      linkedProjectIds: goal.linkedProjectIds ?? [],
    };
  }
  return {
    title: "",
    description: "",
    category: "growth",
    status: "not_started",
    companyId: defaultCompanyId ?? NO_COMPANY,
    targetValue: "",
    currentValue: "",
    unit: "",
    targetDate: "",
    linkedTaskIds: [],
    linkedProjectIds: [],
  };
}

export function GoalFormDialog({
  open,
  onOpenChange,
  goal,
  defaultCompanyId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  goal?: Goal | null;
  defaultCompanyId?: string;
}) {
  const { workspace } = useWorkspace();
  const { data: companies } = useCompanies(workspace?.id ?? null);
  const [submitting, setSubmitting] = useState(false);
  const isEditing = Boolean(goal);
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultsFor(goal, defaultCompanyId),
  });

  useEffect(() => {
    if (!open) return;
    reset(defaultsFor(goal, defaultCompanyId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, goal]);

  const companyId = watch("companyId");
  const linkedTaskIds = watch("linkedTaskIds");
  const linkedProjectIds = watch("linkedProjectIds");
  const { data: companyTasks } = useTasks(
    workspace?.id ?? null,
    companyId && companyId !== NO_COMPANY ? companyId : undefined
  );
  const { data: companyProjects } = useProjects(
    workspace?.id ?? null,
    companyId && companyId !== NO_COMPANY ? companyId : undefined
  );

  function toggleLinkedTask(id: string) {
    setValue(
      "linkedTaskIds",
      linkedTaskIds.includes(id) ? linkedTaskIds.filter((t) => t !== id) : [...linkedTaskIds, id]
    );
  }

  function toggleLinkedProject(id: string) {
    setValue(
      "linkedProjectIds",
      linkedProjectIds.includes(id) ? linkedProjectIds.filter((p) => p !== id) : [...linkedProjectIds, id]
    );
  }

  async function onSubmit(values: FormValues) {
    if (!workspace) return;
    setSubmitting(true);
    try {
      const targetValue = values.targetValue ? Number(values.targetValue) : undefined;
      const currentValue = values.currentValue ? Number(values.currentValue) : undefined;
      const payload = omitUndefined({
        title: values.title,
        description: values.description || undefined,
        category: values.category,
        status: deriveGoalStatus(currentValue, targetValue, values.status),
        companyId: values.companyId && values.companyId !== NO_COMPANY ? values.companyId : undefined,
        targetValue,
        currentValue,
        unit: values.unit || undefined,
        targetDate: values.targetDate ? new Date(`${values.targetDate}T00:00:00`).getTime() : null,
        linkedTaskIds: values.linkedTaskIds.length > 0 ? values.linkedTaskIds : undefined,
        linkedProjectIds: values.linkedProjectIds.length > 0 ? values.linkedProjectIds : undefined,
      });
      const valueChanged = currentValue !== undefined && currentValue !== goal?.currentValue;
      if (isEditing && goal) {
        await updateGoal(workspace.id, goal.id, payload);
        toast.success("Goal updated");
      } else {
        await createGoal(workspace.id, payload);
        toast.success("Goal created");
      }
      if (valueChanged && workspace && currentValue !== undefined) {
        const goalId = isEditing && goal ? goal.id : undefined;
        // Only the edit path has an id to attach history to at this point -
        // create's snapshot would need the just-created doc's id, which
        // createGoal doesn't currently return; the nudge/set-progress paths
        // on the goals page cover the common post-create case instead.
        if (goalId) await recordProgressSnapshot(workspace.id, goalId, currentValue);
      }
      onOpenChange(false);
    } catch {
      toast.error("Couldn't save the goal. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit goal" : "New goal"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input id="title" placeholder="Hit $50k MRR" autoFocus {...register("title")} />
            {errors.title && <p className="text-xs text-danger">{errors.title.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea id="description" rows={3} {...register("description")} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select
                value={watch("category")}
                onValueChange={(v) => setValue("category", v as FormValues["category"])}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(v: string) => GOAL_CATEGORIES.find((c) => c.value === v)?.label ?? v}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {GOAL_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={watch("status")}
                onValueChange={(v) => setValue("status", v as FormValues["status"])}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(v: string) => GOAL_STATUSES.find((s) => s.value === v)?.label ?? v}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {GOAL_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Company (optional)</Label>
            <Select
              value={watch("companyId") ?? NO_COMPANY}
              onValueChange={(v) => setValue("companyId", v ?? NO_COMPANY)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Workspace-wide">
                  {(v: string) =>
                    v === NO_COMPANY
                      ? "Workspace-wide"
                      : (companies.find((c) => c.id === v)?.name ?? "Workspace-wide")
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_COMPANY}>Workspace-wide</SelectItem>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="targetValue">Target</Label>
              <Input id="targetValue" type="number" step="any" placeholder="50000" {...register("targetValue")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="currentValue">Current</Label>
              <Input id="currentValue" type="number" step="any" placeholder="0" {...register("currentValue")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="unit">Unit</Label>
              <Input id="unit" placeholder="$, users…" {...register("unit")} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Target date (optional)</Label>
            <DatePicker value={watch("targetDate")} onChange={(v) => setValue("targetDate", v)} />
          </div>

          <div className="space-y-1.5">
            <Label>Linked tasks (optional)</Label>
            {companyTasks.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                {companyId && companyId !== NO_COMPANY ? "No tasks for this company yet." : "No tasks yet."}
              </p>
            ) : (
              <div className="max-h-36 space-y-1 overflow-x-hidden overflow-y-auto rounded-lg border border-border p-2">
                {companyTasks.map((t) => (
                  <label
                    key={t.id}
                    htmlFor={`linked-task-${t.id}`}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-muted"
                  >
                    <Checkbox
                      id={`linked-task-${t.id}`}
                      checked={linkedTaskIds.includes(t.id)}
                      onCheckedChange={() => toggleLinkedTask(t.id)}
                    />
                    <span className="truncate">{t.title}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Linked projects (optional)</Label>
            {companyProjects.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                {companyId && companyId !== NO_COMPANY ? "No projects for this company yet." : "No projects yet."}
              </p>
            ) : (
              <div className="max-h-36 space-y-1 overflow-x-hidden overflow-y-auto rounded-lg border border-border p-2">
                {companyProjects.map((p) => (
                  <label
                    key={p.id}
                    htmlFor={`linked-project-${p.id}`}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-muted"
                  >
                    <Checkbox
                      id={`linked-project-${p.id}`}
                      checked={linkedProjectIds.includes(p.id)}
                      onCheckedChange={() => toggleLinkedProject(p.id)}
                    />
                    <span className="truncate">{p.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : isEditing ? "Save changes" : "Create goal"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

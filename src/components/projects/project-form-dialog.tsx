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
import { createProject, updateProject } from "@/lib/data/projects";
import { toDateInputValue } from "@/lib/format";
import { priorityLabel } from "@/lib/labels";
import { PRIORITIES, type Project } from "@/lib/types";
import { useWorkspace } from "@/lib/workspace/workspace-provider";

const NO_OWNER = "unassigned";

const schema = z.object({
  name: z.string().min(1, "Name is required").max(150),
  companyId: z.string().min(1, "Pick a company"),
  priority: z.enum(["critical", "high", "medium", "low"]),
  estimatedHours: z.string().optional(),
  description: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  ownerId: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

function defaultsFor(project?: Project | null, defaultCompanyId?: string): FormValues {
  if (project) {
    return {
      name: project.name,
      companyId: project.companyId,
      priority: project.priority,
      estimatedHours: project.estimatedHours !== undefined ? String(project.estimatedHours) : "",
      description: project.description ?? "",
      startDate: project.startDate ? toDateInputValue(project.startDate) : "",
      endDate: project.endDate ? toDateInputValue(project.endDate) : "",
      ownerId: project.ownerId ?? NO_OWNER,
    };
  }
  return {
    name: "",
    companyId: defaultCompanyId ?? "",
    priority: "medium",
    estimatedHours: "",
    description: "",
    startDate: "",
    endDate: "",
    ownerId: NO_OWNER,
  };
}

export function ProjectFormDialog({
  open,
  onOpenChange,
  defaultCompanyId,
  project,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultCompanyId?: string;
  project?: Project | null;
}) {
  const { workspace } = useWorkspace();
  const { data: companies } = useCompanies(workspace?.id ?? null);
  const { data: members } = useMembers(workspace?.id ?? null);
  const [submitting, setSubmitting] = useState(false);
  const isEditing = Boolean(project);
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultsFor(project, defaultCompanyId),
  });

  useEffect(() => {
    if (!open) return;
    reset(defaultsFor(project, defaultCompanyId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, project]);

  async function onSubmit(values: FormValues) {
    if (!workspace) return;
    setSubmitting(true);
    try {
      const payload = omitUndefined({
        companyId: values.companyId,
        name: values.name,
        description: values.description || undefined,
        priority: values.priority,
        estimatedHours: values.estimatedHours ? Number(values.estimatedHours) : undefined,
        startDate: values.startDate ? new Date(`${values.startDate}T00:00:00`).getTime() : null,
        endDate: values.endDate ? new Date(`${values.endDate}T00:00:00`).getTime() : null,
        ownerId: values.ownerId && values.ownerId !== NO_OWNER ? values.ownerId : undefined,
      });
      if (isEditing && project) {
        await updateProject(workspace.id, project.id, payload);
        toast.success("Project updated");
      } else {
        await createProject(workspace.id, { ...payload, status: "not_started" });
        toast.success("Project created");
      }
      reset();
      onOpenChange(false);
    } catch {
      toast.error(isEditing ? "Couldn't update the project. Try again." : "Couldn't create the project. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit project" : "New project"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" placeholder="Website redesign" autoFocus {...register("name")} />
            {errors.name && <p className="text-xs text-danger">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Company</Label>
              <Select value={watch("companyId")} onValueChange={(v) => setValue("companyId", v ?? "")}>
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
              {errors.companyId && <p className="text-xs text-danger">{errors.companyId.message}</p>}
            </div>
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
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Start date (optional)</Label>
              <DatePicker value={watch("startDate")} onChange={(v) => setValue("startDate", v)} />
            </div>
            <div className="space-y-1.5">
              <Label>End date (optional)</Label>
              <DatePicker value={watch("endDate")} onChange={(v) => setValue("endDate", v)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Owner (optional)</Label>
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
              <Input id="estimatedHours" type="number" min={0} placeholder="80" {...register("estimatedHours")} />
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
              {submitting ? "Saving…" : isEditing ? "Save changes" : "Create project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

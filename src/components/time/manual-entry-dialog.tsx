"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
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
import { TimePicker } from "@/components/ui/time-picker";
import { omitUndefined } from "@/lib/data/firestore-helpers";
import { useProjects } from "@/lib/data/projects";
import { useTasks } from "@/lib/data/tasks";
import { logManualEntry } from "@/lib/data/time-entries";
import { timeEntrySubjectLabel } from "@/lib/labels";
import type { Company } from "@/lib/types";

const schema = z
  .object({
    companyId: z.string().min(1, "Pick a company"),
    projectId: z.string().optional(),
    taskId: z.string().optional(),
    date: z.string().min(1),
    startTime: z.string().min(1),
    endTime: z.string().min(1),
    billable: z.boolean(),
    note: z.string().optional(),
  })
  .refine((v) => v.endTime > v.startTime, {
    message: "End time must be after start time",
    path: ["endTime"],
  });

type FormValues = z.infer<typeof schema>;

export function ManualEntryDialog({
  open,
  onOpenChange,
  workspaceId,
  memberId,
  companies,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  workspaceId: string;
  memberId: string;
  companies: Company[];
}) {
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      companyId: companies[0]?.id ?? "",
      projectId: "",
      taskId: "",
      date: new Date().toISOString().slice(0, 10),
      startTime: "09:00",
      endTime: "10:00",
      billable: true,
      note: "",
    },
  });

  useEffect(() => {
    if (open) reset({ ...watch(), companyId: companies[0]?.id ?? watch("companyId") });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const companyId = watch("companyId");
  const projectId = watch("projectId");
  const { data: projects } = useProjects(workspaceId, companyId || undefined);
  const { data: tasksInCompany } = useTasks(workspaceId, companyId || undefined);
  const tasks = useMemo(
    () => (projectId ? tasksInCompany.filter((t) => t.projectId === projectId) : tasksInCompany),
    [tasksInCompany, projectId]
  );

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      const startedAt = new Date(`${values.date}T${values.startTime}`).getTime();
      const endedAt = new Date(`${values.date}T${values.endTime}`).getTime();
      const company = companies.find((c) => c.id === values.companyId);
      const project = projects.find((p) => p.id === values.projectId);
      const task = tasks.find((t) => t.id === values.taskId);
      await logManualEntry(workspaceId, omitUndefined({
        memberId,
        companyId: values.companyId,
        projectId: values.projectId || undefined,
        taskId: values.taskId || undefined,
        startedAt,
        endedAt,
        billable: values.billable,
        note: values.note || undefined,
        subjectLabel: timeEntrySubjectLabel({ company, project, task, note: values.note }),
      }));
      toast.success("Time logged");
      reset();
      onOpenChange(false);
    } catch {
      toast.error("Couldn't log time. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Log time manually</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Company</Label>
            <Select
              value={companyId}
              onValueChange={(v) => {
                setValue("companyId", v ?? "");
                setValue("projectId", "");
                setValue("taskId", "");
              }}
            >
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Project (optional)</Label>
              <Select
                value={projectId}
                onValueChange={(v) => {
                  setValue("projectId", v ?? "");
                  setValue("taskId", "");
                }}
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
            <div className="space-y-1.5">
              <Label>Task (optional)</Label>
              <Select
                value={watch("taskId")}
                onValueChange={(v) => setValue("taskId", v ?? "")}
                disabled={!companyId}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="No task">
                    {(v: string) => tasks.find((t) => t.id === v)?.title ?? "No task"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {tasks.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Date</Label>
            <DatePicker value={watch("date")} onChange={(v) => setValue("date", v)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Start</Label>
              <TimePicker value={watch("startTime")} onChange={(v) => setValue("startTime", v)} />
            </div>
            <div className="space-y-1.5">
              <Label>End</Label>
              <TimePicker value={watch("endTime")} onChange={(v) => setValue("endTime", v)} />
              {errors.endTime && <p className="text-xs text-danger">{errors.endTime.message}</p>}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="billable"
              checked={watch("billable")}
              onCheckedChange={(v) => setValue("billable", Boolean(v))}
            />
            <Label htmlFor="billable" className="font-normal">
              Billable
            </Label>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="note">Note (optional)</Label>
            <Input id="note" placeholder="What did you work on?" {...register("note")} />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Logging…" : "Log time"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
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
import { createProject } from "@/lib/data/projects";
import { priorityLabel } from "@/lib/labels";
import { PRIORITIES } from "@/lib/types";
import { useWorkspace } from "@/lib/workspace/workspace-provider";

const schema = z.object({
  name: z.string().min(1, "Name is required").max(150),
  companyId: z.string().min(1, "Pick a company"),
  priority: z.enum(["critical", "high", "medium", "low"]),
  estimatedHours: z.string().optional(),
  description: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function ProjectFormDialog({
  open,
  onOpenChange,
  defaultCompanyId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultCompanyId?: string;
}) {
  const { workspace } = useWorkspace();
  const { data: companies } = useCompanies(workspace?.id ?? null);
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
      name: "",
      companyId: defaultCompanyId ?? "",
      priority: "medium",
      estimatedHours: "",
      description: "",
    },
  });

  useEffect(() => {
    if (open && defaultCompanyId) setValue("companyId", defaultCompanyId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultCompanyId]);

  async function onSubmit(values: FormValues) {
    if (!workspace) return;
    setSubmitting(true);
    try {
      await createProject(workspace.id, omitUndefined({
        companyId: values.companyId,
        name: values.name,
        description: values.description || undefined,
        priority: values.priority,
        status: "not_started",
        estimatedHours: values.estimatedHours ? Number(values.estimatedHours) : undefined,
      }));
      toast.success("Project created");
      reset();
      onOpenChange(false);
    } catch {
      toast.error("Couldn't create the project. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
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

          <div className="space-y-1.5">
            <Label htmlFor="estimatedHours">Estimated hours (optional)</Label>
            <Input id="estimatedHours" type="number" min={0} placeholder="80" {...register("estimatedHours")} />
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
              {submitting ? "Creating…" : "Create project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

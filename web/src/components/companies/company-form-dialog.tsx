"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
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
import { createCompany } from "@/lib/data/companies";
import { useWorkspace } from "@/lib/workspace/workspace-provider";

const COLORS = ["#2563EB", "#8B5CF6", "#06B6D4", "#EC4899", "#F97316", "#22C55E", "#F59E0B", "#71717A"];

const schema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  industry: z.string().optional(),
  type: z.enum(["startup", "client", "agency", "personal", "investment"]),
  stage: z.enum(["idea", "pre-launch", "launched", "growth", "scaling", "mature"]),
  currency: z.string().min(1),
  color: z.string(),
});

type FormValues = z.infer<typeof schema>;

export function CompanyFormDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { workspace } = useWorkspace();
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
      industry: "",
      type: "startup",
      stage: "idea",
      currency: "USD",
      color: COLORS[0],
    },
  });

  async function onSubmit(values: FormValues) {
    if (!workspace) return;
    setSubmitting(true);
    try {
      await createCompany(workspace.id, {
        name: values.name,
        industry: values.industry || undefined,
        type: values.type,
        stage: values.stage,
        status: "active",
        currency: values.currency,
        color: values.color,
      });
      toast.success(`${values.name} created`);
      reset();
      onOpenChange(false);
    } catch {
      toast.error("Couldn't create the company. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New company</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" placeholder="Acme Inc." autoFocus {...register("name")} />
            {errors.name && <p className="text-xs text-danger">{errors.name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="industry">Industry (optional)</Label>
            <Input id="industry" placeholder="SaaS, Retail, Consulting…" {...register("industry")} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={watch("type")} onValueChange={(v) => setValue("type", v as FormValues["type"])}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["startup", "client", "agency", "personal", "investment"].map((t) => (
                    <SelectItem key={t} value={t} className="capitalize">
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Stage</Label>
              <Select value={watch("stage")} onValueChange={(v) => setValue("stage", v as FormValues["stage"])}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["idea", "pre-launch", "launched", "growth", "scaling", "mature"].map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">
                      {s.replace("-", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="currency">Currency</Label>
            <Input id="currency" placeholder="USD" maxLength={3} className="uppercase" {...register("currency")} />
          </div>

          <div className="space-y-1.5">
            <Label>Color</Label>
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setValue("color", c)}
                  className="size-7 rounded-full ring-offset-2 ring-offset-background transition-all"
                  style={{
                    backgroundColor: c,
                    outline: watch("color") === c ? `2px solid ${c}` : "none",
                    outlineOffset: 2,
                  }}
                />
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating…" : "Create company"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { zodResolver } from "@hookform/resolvers/zod";
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
import { omitUndefined } from "@/lib/data/firestore-helpers";
import { createBudget, updateBudget } from "@/lib/data/budgets";
import { toDateInputValue } from "@/lib/format";
import { BUDGET_PERIODS, EXPENSE_CATEGORIES, type Budget, type Company } from "@/lib/types";

const schema = z.object({
  companyId: z.string().min(1, "Pick a company"),
  category: z.enum(["software", "payroll", "marketing", "office", "travel", "legal", "other"]),
  period: z.enum(["monthly", "quarterly", "yearly"]),
  periodStart: z.string().min(1),
  allocatedAmount: z
    .string()
    .min(1, "Amount is required")
    .refine((v) => !isNaN(Number(v)) && Number(v) > 0, "Amount must be greater than 0"),
  currency: z.string().min(1),
  recurring: z.boolean(),
  note: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function BudgetFormDialog({
  open,
  onOpenChange,
  workspaceId,
  companies,
  budget,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  workspaceId: string;
  companies: Company[];
  budget?: Budget | null;
}) {
  const [submitting, setSubmitting] = useState(false);
  const isEditing = Boolean(budget);
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
      category: "software",
      period: "monthly",
      periodStart: toDateInputValue(),
      allocatedAmount: "",
      currency: companies[0]?.currency ?? "LKR",
      recurring: false,
      note: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    if (budget) {
      reset({
        companyId: budget.companyId,
        category: budget.category,
        period: budget.period,
        periodStart: toDateInputValue(budget.periodStart),
        allocatedAmount: String(budget.allocatedAmount),
        currency: budget.currency,
        recurring: budget.recurring ?? false,
        note: budget.note ?? "",
      });
    } else {
      reset({
        companyId: companies[0]?.id ?? "",
        category: "software",
        period: "monthly",
        periodStart: toDateInputValue(),
        allocatedAmount: "",
        currency: companies[0]?.currency ?? "LKR",
        recurring: false,
        note: "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, budget]);

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      const periodStart = new Date(`${values.periodStart}T00:00:00`).getTime();
      if (isEditing && budget) {
        await updateBudget(workspaceId, budget.id, omitUndefined({
          companyId: values.companyId,
          category: values.category,
          period: values.period,
          periodStart,
          allocatedAmount: Number(values.allocatedAmount),
          currency: values.currency,
          recurring: values.recurring,
          note: values.note || undefined,
        }));
        toast.success("Budget updated");
      } else {
        await createBudget(workspaceId, omitUndefined({
          companyId: values.companyId,
          category: values.category,
          period: values.period,
          periodStart,
          allocatedAmount: Number(values.allocatedAmount),
          currency: values.currency,
          recurring: values.recurring,
          note: values.note || undefined,
        }));
        toast.success("Budget created");
      }
      onOpenChange(false);
    } catch {
      toast.error("Couldn't save the budget. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit budget" : "New budget"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select
                value={watch("category")}
                onValueChange={(v) => setValue("category", v as FormValues["category"])}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(v: string) => EXPENSE_CATEGORIES.find((c) => c.value === v)?.label ?? v}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Period</Label>
              <Select
                value={watch("period")}
                onValueChange={(v) => setValue("period", v as FormValues["period"])}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(v: string) => BUDGET_PERIODS.find((p) => p.value === v)?.label ?? v}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {BUDGET_PERIODS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Period starts</Label>
            <DatePicker value={watch("periodStart")} onChange={(v) => setValue("periodStart", v)} />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="recurring"
              checked={watch("recurring")}
              onCheckedChange={(v) => setValue("recurring", Boolean(v))}
            />
            <Label htmlFor="recurring" className="font-normal">
              Repeat automatically every {watch("period")}
            </Label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="allocatedAmount">Allocated amount</Label>
              <Input id="allocatedAmount" type="number" step="0.01" min="0" {...register("allocatedAmount")} />
              {errors.allocatedAmount && (
                <p className="text-xs text-danger">{errors.allocatedAmount.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="currency">Currency</Label>
              <Input id="currency" maxLength={3} className="uppercase" {...register("currency")} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="note">Note (optional)</Label>
            <Input id="note" placeholder="Any extra detail" {...register("note")} />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : isEditing ? "Save changes" : "Create budget"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

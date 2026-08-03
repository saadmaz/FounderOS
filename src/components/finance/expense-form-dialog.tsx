"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { createExpense, updateExpense } from "@/lib/data/expenses";
import { EXPENSE_CATEGORIES, EXPENSE_STATUSES, type Company, type Expense } from "@/lib/types";

const schema = z.object({
  companyId: z.string().min(1, "Pick a company"),
  category: z.enum(["software", "payroll", "marketing", "office", "travel", "legal", "other"]),
  status: z.enum(["pending", "approved", "reimbursed", "rejected"]),
  amount: z
    .string()
    .min(1, "Amount is required")
    .refine((v) => !isNaN(Number(v)) && Number(v) > 0, "Amount must be greater than 0"),
  currency: z.string().min(1),
  date: z.string().min(1),
  billable: z.boolean(),
  description: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function ExpenseFormDialog({
  open,
  onOpenChange,
  workspaceId,
  memberId,
  companies,
  expense,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  workspaceId: string;
  memberId: string;
  companies: Company[];
  expense?: Expense | null;
}) {
  const [submitting, setSubmitting] = useState(false);
  const isEditing = Boolean(expense);
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
      status: "pending",
      amount: "",
      currency: companies[0]?.currency ?? "USD",
      date: new Date().toISOString().slice(0, 10),
      billable: false,
      description: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    if (expense) {
      reset({
        companyId: expense.companyId,
        category: expense.category,
        status: expense.status,
        amount: String(expense.amount),
        currency: expense.currency,
        date: new Date(expense.date).toISOString().slice(0, 10),
        billable: expense.billable,
        description: expense.description ?? "",
      });
    } else {
      reset({
        companyId: companies[0]?.id ?? "",
        category: "software",
        status: "pending",
        amount: "",
        currency: companies[0]?.currency ?? "USD",
        date: new Date().toISOString().slice(0, 10),
        billable: false,
        description: "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, expense]);

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      const date = new Date(`${values.date}T00:00:00`).getTime();
      if (isEditing && expense) {
        await updateExpense(workspaceId, expense.id, {
          companyId: values.companyId,
          category: values.category,
          status: values.status,
          amount: Number(values.amount),
          currency: values.currency,
          date,
          billable: values.billable,
          description: values.description || undefined,
        });
        toast.success("Expense updated");
      } else {
        await createExpense(workspaceId, {
          companyId: values.companyId,
          category: values.category,
          status: values.status,
          amount: Number(values.amount),
          currency: values.currency,
          date,
          billable: values.billable,
          description: values.description || undefined,
          createdBy: memberId,
        });
        toast.success("Expense added");
      }
      onOpenChange(false);
    } catch {
      toast.error("Couldn't save the expense. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit expense" : "New expense"}</DialogTitle>
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
              <Label>Status</Label>
              <Select
                value={watch("status")}
                onValueChange={(v) => setValue("status", v as FormValues["status"])}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(v: string) => EXPENSE_STATUSES.find((s) => s.value === v)?.label ?? v}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="amount">Amount</Label>
              <Input id="amount" type="number" step="0.01" min="0" {...register("amount")} />
              {errors.amount && <p className="text-xs text-danger">{errors.amount.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="currency">Currency</Label>
              <Input id="currency" maxLength={3} className="uppercase" {...register("currency")} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="date">Date</Label>
            <Input id="date" type="date" {...register("date")} />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="billable"
              checked={watch("billable")}
              onCheckedChange={(v) => setValue("billable", Boolean(v))}
            />
            <Label htmlFor="billable" className="font-normal">
              Billable to client
            </Label>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description (optional)</Label>
            <Input id="description" placeholder="What was this for?" {...register("description")} />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : isEditing ? "Save changes" : "Add expense"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

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
import { omitUndefined } from "@/lib/data/firestore-helpers";
import { createInvestment, updateInvestment } from "@/lib/data/investments";
import {
  INVESTMENT_STATUSES,
  INVESTMENT_TYPES,
  type Company,
  type Investment,
} from "@/lib/types";

const schema = z.object({
  companyId: z.string().min(1, "Pick a company"),
  type: z.enum([
    "equity",
    "safe",
    "convertible_note",
    "debt",
    "real_estate",
    "stocks",
    "crypto",
    "fund",
    "other",
  ]),
  status: z.enum(["active", "exited", "written_off"]),
  amount: z
    .string()
    .min(1, "Amount is required")
    .refine((v) => !isNaN(Number(v)) && Number(v) > 0, "Amount must be greater than 0"),
  currency: z.string().min(1),
  date: z.string().min(1),
  currentValue: z
    .string()
    .optional()
    .refine((v) => !v || (!isNaN(Number(v)) && Number(v) >= 0), "Must be ≥ 0"),
  ownershipPercent: z
    .string()
    .optional()
    .refine((v) => !v || (!isNaN(Number(v)) && Number(v) >= 0 && Number(v) <= 100), "Must be 0-100"),
  note: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

/**
 * Tracks capital *you* put into a company/asset. Mirrors BudgetFormDialog's
 * shape: one company-scoped record, an amount, a date, an optional note.
 */
export function InvestmentFormDialog({
  open,
  onOpenChange,
  workspaceId,
  companies,
  investment,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  workspaceId: string;
  companies: Company[];
  investment?: Investment | null;
}) {
  const [submitting, setSubmitting] = useState(false);
  const isEditing = Boolean(investment);
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
      type: "equity",
      status: "active",
      amount: "",
      currency: companies[0]?.currency ?? "LKR",
      date: new Date().toISOString().slice(0, 10),
      currentValue: "",
      ownershipPercent: "",
      note: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    if (investment) {
      reset({
        companyId: investment.companyId,
        type: investment.type,
        status: investment.status,
        amount: String(investment.amount),
        currency: investment.currency,
        date: new Date(investment.date).toISOString().slice(0, 10),
        currentValue: investment.currentValue !== undefined ? String(investment.currentValue) : "",
        ownershipPercent:
          investment.ownershipPercent !== undefined ? String(investment.ownershipPercent) : "",
        note: investment.note ?? "",
      });
    } else {
      reset({
        companyId: companies[0]?.id ?? "",
        type: "equity",
        status: "active",
        amount: "",
        currency: companies[0]?.currency ?? "LKR",
        date: new Date().toISOString().slice(0, 10),
        currentValue: "",
        ownershipPercent: "",
        note: "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, investment]);

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      const date = new Date(`${values.date}T00:00:00`).getTime();
      const payload = omitUndefined({
        companyId: values.companyId,
        type: values.type,
        status: values.status,
        amount: Number(values.amount),
        currency: values.currency,
        date,
        currentValue: values.currentValue ? Number(values.currentValue) : undefined,
        ownershipPercent: values.ownershipPercent ? Number(values.ownershipPercent) : undefined,
        note: values.note || undefined,
      });
      if (isEditing && investment) {
        await updateInvestment(workspaceId, investment.id, payload);
        toast.success("Investment updated");
      } else {
        await createInvestment(workspaceId, payload);
        toast.success("Investment logged");
      }
      onOpenChange(false);
    } catch {
      toast.error("Couldn't save the investment. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit investment" : "New investment"}</DialogTitle>
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
              <Label>Type</Label>
              <Select
                value={watch("type")}
                onValueChange={(v) => setValue("type", v as FormValues["type"])}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(v: string) => INVESTMENT_TYPES.find((t) => t.value === v)?.label ?? v}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {INVESTMENT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
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
                    {(v: string) => INVESTMENT_STATUSES.find((s) => s.value === v)?.label ?? v}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {INVESTMENT_STATUSES.map((s) => (
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
              <Label htmlFor="amount">Amount invested</Label>
              <Input id="amount" type="number" step="0.01" min="0" {...register("amount")} />
              {errors.amount && <p className="text-xs text-danger">{errors.amount.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="currency">Currency</Label>
              <Input id="currency" maxLength={3} className="uppercase" {...register("currency")} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Date</Label>
            <DatePicker value={watch("date")} onChange={(v) => setValue("date", v)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="currentValue">Current value (optional)</Label>
              <Input id="currentValue" type="number" step="0.01" min="0" {...register("currentValue")} />
              {errors.currentValue && (
                <p className="text-xs text-danger">{errors.currentValue.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ownershipPercent">Ownership % (optional)</Label>
              <Input
                id="ownershipPercent"
                type="number"
                step="0.01"
                min="0"
                max="100"
                {...register("ownershipPercent")}
              />
              {errors.ownershipPercent && (
                <p className="text-xs text-danger">{errors.ownershipPercent.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="note">Note (optional)</Label>
            <Input id="note" placeholder="Round, terms, anything worth remembering" {...register("note")} />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : isEditing ? "Save changes" : "Add investment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

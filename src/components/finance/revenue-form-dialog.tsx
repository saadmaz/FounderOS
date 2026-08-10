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
import { createRevenueEntry, updateRevenueEntry } from "@/lib/data/revenue";
import { REVENUE_CATEGORIES, type Company, type RevenueEntry } from "@/lib/types";

const schema = z.object({
  companyId: z.string().min(1, "Pick a company"),
  category: z.enum(["sales", "subscription", "services", "investment", "other"]),
  amount: z
    .string()
    .min(1, "Amount is required")
    .refine((v) => !isNaN(Number(v)) && Number(v) > 0, "Amount must be greater than 0"),
  currency: z.string().min(1),
  date: z.string().min(1),
  source: z.string().optional(),
  note: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function RevenueFormDialog({
  open,
  onOpenChange,
  workspaceId,
  companies,
  entry,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  workspaceId: string;
  companies: Company[];
  entry?: RevenueEntry | null;
}) {
  const [submitting, setSubmitting] = useState(false);
  const isEditing = Boolean(entry);
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
      category: "sales",
      amount: "",
      currency: companies[0]?.currency ?? "LKR",
      date: new Date().toISOString().slice(0, 10),
      source: "",
      note: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    if (entry) {
      reset({
        companyId: entry.companyId,
        category: entry.category,
        amount: String(entry.amount),
        currency: entry.currency,
        date: new Date(entry.date).toISOString().slice(0, 10),
        source: entry.source ?? "",
        note: entry.note ?? "",
      });
    } else {
      reset({
        companyId: companies[0]?.id ?? "",
        category: "sales",
        amount: "",
        currency: companies[0]?.currency ?? "LKR",
        date: new Date().toISOString().slice(0, 10),
        source: "",
        note: "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, entry]);

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      const date = new Date(`${values.date}T00:00:00`).getTime();
      if (isEditing && entry) {
        await updateRevenueEntry(workspaceId, entry.id, omitUndefined({
          companyId: values.companyId,
          category: values.category,
          amount: Number(values.amount),
          currency: values.currency,
          date,
          source: values.source || undefined,
          note: values.note || undefined,
        }));
        toast.success("Revenue entry updated");
      } else {
        await createRevenueEntry(workspaceId, omitUndefined({
          companyId: values.companyId,
          category: values.category,
          amount: Number(values.amount),
          currency: values.currency,
          date,
          source: values.source || undefined,
          note: values.note || undefined,
        }));
        toast.success("Revenue logged");
      }
      onOpenChange(false);
    } catch {
      toast.error("Couldn't save the revenue entry. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit revenue" : "New revenue"}</DialogTitle>
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

          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select
              value={watch("category")}
              onValueChange={(v) => setValue("category", v as FormValues["category"])}
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(v: string) => REVENUE_CATEGORIES.find((c) => c.value === v)?.label ?? v}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {REVENUE_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            <Label>Date</Label>
            <DatePicker value={watch("date")} onChange={(v) => setValue("date", v)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="source">Source (optional)</Label>
            <Input id="source" placeholder="Client name, platform…" {...register("source")} />
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
              {submitting ? "Saving…" : isEditing ? "Save changes" : "Add revenue"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

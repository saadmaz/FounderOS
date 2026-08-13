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
import { AttachmentField } from "@/components/finance/attachment-field";
import { deleteCloudinaryAsset, uploadDocumentToCloudinary } from "@/lib/cloudinary";
import { now, omitUndefined } from "@/lib/data/firestore-helpers";
import { createExpense, setExpenseStatus, updateExpense } from "@/lib/data/expenses";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_STATUSES,
  type Company,
  type Expense,
  type FinanceAttachment,
} from "@/lib/types";

const schema = z.object({
  companyId: z.string().min(1, "Pick a company"),
  title: z.string().min(1, "Give the expense a name").max(150),
  category: z.enum(["software", "payroll", "marketing", "office", "travel", "legal", "other"]),
  vendor: z.string().optional(),
  amount: z
    .string()
    .min(1, "Amount is required")
    .refine((v) => !isNaN(Number(v)) && Number(v) > 0, "Amount must be greater than 0"),
  currency: z.string().min(1),
  date: z.string().min(1),
  status: z.enum(["pending", "reimbursed"]),
  description: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const emptyDefaults = (companies: Company[]): FormValues => ({
  companyId: companies[0]?.id ?? "",
  title: "",
  category: "software",
  vendor: "",
  amount: "",
  currency: companies[0]?.currency ?? "LKR",
  date: new Date().toISOString().slice(0, 10),
  status: "pending",
  description: "",
});

/**
 * Logs money *you* put in on a company's behalf - laid out to follow how
 * someone actually fills it in: which company this was for, what it was (a
 * required name - the thing that makes a list of expenses scannable), how
 * much and when, how it's classified, and where it stands on getting paid
 * back. Description is optional and separate from the name - a place for
 * detail, not the label itself.
 */
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
  const [receiptFiles, setReceiptFiles] = useState<File[]>([]);
  const [removedReceipts, setRemovedReceipts] = useState<FinanceAttachment[]>([]);
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
    defaultValues: emptyDefaults(companies),
  });

  useEffect(() => {
    if (!open) return;
    setReceiptFiles([]);
    setRemovedReceipts([]);
    if (expense) {
      reset({
        companyId: expense.companyId,
        title: expense.title,
        category: expense.category,
        vendor: expense.vendor ?? "",
        amount: String(expense.amount),
        currency: expense.currency,
        date: new Date(expense.date).toISOString().slice(0, 10),
        status: expense.status,
        description: expense.description ?? "",
      });
    } else {
      reset(emptyDefaults(companies));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, expense]);

  /** Uploads every newly staged file, drops any existing receipt the user
   * removed (best-effort Cloudinary cleanup - a hiccup there shouldn't block
   * saving the expense), and returns the full resulting list. */
  async function resolveReceipts(): Promise<FinanceAttachment[]> {
    const uploaded = await Promise.all(
      receiptFiles.map(async (file) => {
        const result = await uploadDocumentToCloudinary(file, `founderos/${workspaceId}/receipts`);
        return {
          url: result.url,
          publicId: result.publicId,
          resourceType: result.resourceType as FinanceAttachment["resourceType"],
          name: file.name,
          size: file.size,
        };
      })
    );
    for (const att of removedReceipts) {
      deleteCloudinaryAsset(att.publicId, att.resourceType).catch(() => {});
    }
    const kept = (expense?.receipts ?? []).filter(
      (att) => !removedReceipts.some((r) => r.publicId === att.publicId)
    );
    return [...kept, ...uploaded];
  }

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      const date = new Date(`${values.date}T00:00:00`).getTime();
      const receipts = await resolveReceipts();
      if (isEditing && expense) {
        // Status is handled separately via setExpenseStatus, which is the
        // one place that keeps reimbursedAt/reimbursedBy in sync (it can
        // actually clear them with deleteField() - this update can only
        // omit fields, never clear a stored one, so it must never touch
        // status itself).
        await updateExpense(workspaceId, expense.id, omitUndefined({
          companyId: values.companyId,
          title: values.title,
          category: values.category,
          vendor: values.vendor || undefined,
          amount: Number(values.amount),
          currency: values.currency,
          date,
          description: values.description || undefined,
          receipts,
        }));
        if (values.status !== expense.status) {
          await setExpenseStatus(workspaceId, expense.id, values.status, memberId);
        }
        toast.success("Expense updated");
      } else {
        const reimbursedNow = values.status === "reimbursed";
        await createExpense(workspaceId, omitUndefined({
          companyId: values.companyId,
          title: values.title,
          category: values.category,
          vendor: values.vendor || undefined,
          amount: Number(values.amount),
          currency: values.currency,
          date,
          status: values.status,
          reimbursedAt: reimbursedNow ? now() : undefined,
          reimbursedBy: reimbursedNow ? memberId : undefined,
          description: values.description || undefined,
          receipts,
          createdBy: memberId,
        }));
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

          <div className="space-y-1.5">
            <Label htmlFor="title">What was it for?</Label>
            <Input id="title" placeholder="AWS hosting, Office rent, Team lunch…" autoFocus {...register("title")} />
            {errors.title && <p className="text-xs text-danger">{errors.title.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="amount">Amount</Label>
              <Input id="amount" type="number" step="0.01" min="0" {...register("amount")} />
              {errors.amount && <p className="text-xs text-danger">{errors.amount.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="currency">Currency</Label>
              <Input id="currency" placeholder="LKR" maxLength={3} className="uppercase" {...register("currency")} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Date</Label>
            <DatePicker value={watch("date")} onChange={(v) => setValue("date", v)} />
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
              <Label htmlFor="vendor">Vendor (optional)</Label>
              <Input id="vendor" placeholder="Who was this paid to?" {...register("vendor")} />
            </div>
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

          <div className="space-y-1.5">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              placeholder="Any extra detail - what it covered, why, who approved it…"
              rows={2}
              {...register("description")}
            />
          </div>

          <AttachmentField
            label="Receipts (optional)"
            existing={(expense?.receipts ?? []).filter(
              (att) => !removedReceipts.some((r) => r.publicId === att.publicId)
            )}
            onRemoveExisting={(att) => setRemovedReceipts((prev) => [...prev, att])}
            files={receiptFiles}
            onFilesChange={setReceiptFiles}
          />

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

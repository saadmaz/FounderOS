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
import { Textarea } from "@/components/ui/textarea";
import { AttachmentField } from "@/components/finance/attachment-field";
import { deleteCloudinaryAsset, uploadDocumentToCloudinary } from "@/lib/cloudinary";
import { omitUndefined } from "@/lib/data/firestore-helpers";
import { createExpense, updateExpense } from "@/lib/data/expenses";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_STATUSES,
  type Company,
  type Expense,
  type FinanceAttachment,
  type Vendor,
} from "@/lib/types";

const NO_VENDOR = "none";

const schema = z.object({
  companyId: z.string().min(1, "Pick a company"),
  title: z.string().min(1, "Give the expense a name").max(150),
  category: z.enum(["software", "payroll", "marketing", "office", "travel", "legal", "other"]),
  vendorId: z.string(),
  amount: z
    .string()
    .min(1, "Amount is required")
    .refine((v) => !isNaN(Number(v)) && Number(v) > 0, "Amount must be greater than 0"),
  currency: z.string().min(1),
  date: z.string().min(1),
  status: z.enum(["pending", "approved", "paid", "reimbursed", "rejected"]),
  billable: z.boolean(),
  description: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const emptyDefaults = (companies: Company[]): FormValues => ({
  companyId: companies[0]?.id ?? "",
  title: "",
  category: "software",
  vendorId: NO_VENDOR,
  amount: "",
  currency: companies[0]?.currency ?? "LKR",
  date: new Date().toISOString().slice(0, 10),
  status: "pending",
  billable: false,
  description: "",
});

/**
 * Expense entry, laid out to follow how someone actually fills it in: which
 * company this belongs to, what it was (a required name - the thing that
 * makes a list of expenses scannable, previously missing entirely), how
 * much and when, how it's classified, whether it's already settled, and
 * finally any extra detail plus a receipt. Description is optional and
 * separate from the name - a place for detail, not the label itself.
 */
export function ExpenseFormDialog({
  open,
  onOpenChange,
  workspaceId,
  memberId,
  companies,
  vendors = [],
  expense,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  workspaceId: string;
  memberId: string;
  companies: Company[];
  vendors?: Vendor[];
  expense?: Expense | null;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [removeReceipt, setRemoveReceipt] = useState(false);
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
    setReceiptFile(null);
    setRemoveReceipt(false);
    if (expense) {
      reset({
        companyId: expense.companyId,
        title: expense.title,
        category: expense.category,
        vendorId: expense.vendorId ?? NO_VENDOR,
        amount: String(expense.amount),
        currency: expense.currency,
        date: new Date(expense.date).toISOString().slice(0, 10),
        status: expense.status,
        billable: expense.billable,
        description: expense.description ?? "",
      });
    } else {
      reset(emptyDefaults(companies));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, expense]);

  const companyId = watch("companyId");
  const companyVendors = useMemo(
    () => vendors.filter((v) => v.companyId === companyId),
    [vendors, companyId]
  );
  const vendorId = watch("vendorId");

  // Switching the company can strand the picked vendor (it belongs to the
  // old company) - drop back to "No vendor" rather than silently keep a
  // vendor that no longer matches what's shown in the dropdown.
  useEffect(() => {
    if (vendorId !== NO_VENDOR && !companyVendors.some((v) => v.id === vendorId)) {
      setValue("vendorId", NO_VENDOR);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, companyVendors]);

  async function resolveReceipt(): Promise<FinanceAttachment | null | undefined> {
    if (receiptFile) {
      const uploaded = await uploadDocumentToCloudinary(receiptFile, `founderos/${workspaceId}/receipts`);
      if (expense?.receipt) {
        deleteCloudinaryAsset(expense.receipt.publicId, expense.receipt.resourceType).catch(() => {});
      }
      return {
        url: uploaded.url,
        publicId: uploaded.publicId,
        resourceType: uploaded.resourceType as FinanceAttachment["resourceType"],
        name: receiptFile.name,
        size: receiptFile.size,
      };
    }
    if (removeReceipt) {
      if (expense?.receipt) {
        deleteCloudinaryAsset(expense.receipt.publicId, expense.receipt.resourceType).catch(() => {});
      }
      // null (not undefined) so the update actually clears the field in
      // Firestore instead of omitUndefined silently dropping the key.
      return null;
    }
    return expense?.receipt;
  }

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      const date = new Date(`${values.date}T00:00:00`).getTime();
      const receipt = await resolveReceipt();
      const vendorId = values.vendorId === NO_VENDOR ? undefined : values.vendorId;
      if (isEditing && expense) {
        await updateExpense(workspaceId, expense.id, omitUndefined({
          companyId: values.companyId,
          title: values.title,
          category: values.category,
          vendorId,
          amount: Number(values.amount),
          currency: values.currency,
          date,
          status: values.status,
          billable: values.billable,
          description: values.description || undefined,
          receipt,
        }));
        toast.success("Expense updated");
      } else {
        await createExpense(workspaceId, omitUndefined({
          companyId: values.companyId,
          title: values.title,
          category: values.category,
          vendorId,
          amount: Number(values.amount),
          currency: values.currency,
          date,
          status: values.status,
          billable: values.billable,
          description: values.description || undefined,
          receipt,
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
              <Label>Vendor (optional)</Label>
              <Select value={watch("vendorId")} onValueChange={(v) => setValue("vendorId", v ?? NO_VENDOR)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="No vendor">
                    {(v: string) =>
                      v === NO_VENDOR ? "No vendor" : companyVendors.find((ven) => ven.id === v)?.name ?? "No vendor"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_VENDOR}>No vendor</SelectItem>
                  {companyVendors.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            <Textarea
              id="description"
              placeholder="Any extra detail - what it covered, why, who approved it…"
              rows={2}
              {...register("description")}
            />
          </div>

          <AttachmentField
            label="Receipt (optional)"
            existing={removeReceipt ? null : expense?.receipt}
            onRemoveExisting={() => setRemoveReceipt(true)}
            file={receiptFile}
            onFileChange={setReceiptFile}
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

"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { SectionLabel } from "@/components/crm/section-label";
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
import { CurrencySelect } from "@/components/finance/currency-select";
import { deleteCloudinaryAsset, uploadDocumentToCloudinary } from "@/lib/cloudinary";
import { omitUndefined } from "@/lib/data/firestore-helpers";
import { createInvestment, updateInvestment } from "@/lib/data/investments";
import {
  INVESTMENT_STATUSES,
  INVESTMENT_TYPES,
  type Company,
  type FinanceAttachment,
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
  description: z.string().min(1, "Describe the investment").max(150),
  amount: z
    .string()
    .min(1, "Amount is required")
    .refine((v) => !isNaN(Number(v)) && Number(v) > 0, "Amount must be greater than 0"),
  currency: z.string().min(1, "Pick a currency"),
  date: z.string().min(1),
  note: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const emptyDefaults = (companies: Company[]): FormValues => ({
  companyId: companies[0]?.id ?? "",
  type: "equity",
  status: "active",
  description: "",
  amount: "",
  currency: companies[0]?.currency ?? "LKR",
  date: new Date().toISOString().slice(0, 10),
  note: "",
});

/**
 * Logs capital *you* put into a company/asset - a log of what went in, not
 * a mark-to-market tracker (no current value/ownership % fields; status
 * covers whether it's still active/exited/written off). Mirrors
 * ExpenseFormDialog's shape: a required scannable description first, then
 * how much/when/how it's classified, an optional note, and supporting
 * documents.
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
  const [documentFiles, setDocumentFiles] = useState<File[]>([]);
  const [removedDocuments, setRemovedDocuments] = useState<FinanceAttachment[]>([]);
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
    defaultValues: emptyDefaults(companies),
  });

  useEffect(() => {
    if (!open) return;
    setDocumentFiles([]);
    setRemovedDocuments([]);
    if (investment) {
      reset({
        companyId: investment.companyId,
        type: investment.type,
        status: investment.status,
        description: investment.description,
        amount: String(investment.amount),
        currency: investment.currency,
        date: new Date(investment.date).toISOString().slice(0, 10),
        note: investment.note ?? "",
      });
    } else {
      reset(emptyDefaults(companies));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, investment]);

  /** Uploads every newly staged file, drops any existing document the user
   * removed (best-effort Cloudinary cleanup - a hiccup there shouldn't block
   * saving the investment), and returns the full resulting list. */
  async function resolveDocuments(): Promise<FinanceAttachment[]> {
    const uploaded = await Promise.all(
      documentFiles.map(async (file) => {
        const result = await uploadDocumentToCloudinary(file, `founderos/${workspaceId}/investment-documents`);
        return {
          url: result.url,
          publicId: result.publicId,
          resourceType: result.resourceType as FinanceAttachment["resourceType"],
          name: file.name,
          size: file.size,
        };
      })
    );
    for (const att of removedDocuments) {
      deleteCloudinaryAsset(att.publicId, att.resourceType).catch(() => {});
    }
    const kept = (investment?.documents ?? []).filter(
      (att) => !removedDocuments.some((r) => r.publicId === att.publicId)
    );
    return [...kept, ...uploaded];
  }

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      const date = new Date(`${values.date}T00:00:00`).getTime();
      const documents = await resolveDocuments();
      const payload = omitUndefined({
        companyId: values.companyId,
        type: values.type,
        status: values.status,
        description: values.description,
        amount: Number(values.amount),
        currency: values.currency,
        date,
        note: values.note || undefined,
        documents,
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
          <SectionLabel>Investment details</SectionLabel>

          <div className="space-y-1.5">
            <Label htmlFor="description">What was it?</Label>
            <Input
              id="description"
              placeholder="Series A round in Acme Corp, SAFE note…"
              autoFocus
              {...register("description")}
            />
            {errors.description && <p className="text-xs text-danger">{errors.description.message}</p>}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                      <span className="flex items-center gap-2">
                        <span className="size-2 rounded-full" style={{ backgroundColor: c.color }} />
                        {c.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.companyId && <p className="text-xs text-danger">{errors.companyId.message}</p>}
            </div>
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
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
            <div className="space-y-1.5">
              <Label>Date</Label>
              <DatePicker value={watch("date")} onChange={(v) => setValue("date", v)} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="amount">Amount invested</Label>
              <Input id="amount" type="number" step="0.01" min="0" {...register("amount")} />
              {errors.amount && <p className="text-xs text-danger">{errors.amount.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <CurrencySelect value={watch("currency")} onChange={(v) => setValue("currency", v)} />
              {errors.currency && <p className="text-xs text-danger">{errors.currency.message}</p>}
            </div>
          </div>

          <SectionLabel>Notes & documents</SectionLabel>

          <div className="space-y-1.5">
            <Label htmlFor="note">Notes (optional)</Label>
            <Textarea
              id="note"
              rows={3}
              placeholder="Terms, deal structure, anything worth remembering"
              {...register("note")}
            />
          </div>

          <AttachmentField
            label="Documents (optional)"
            existing={(investment?.documents ?? []).filter(
              (att) => !removedDocuments.some((r) => r.publicId === att.publicId)
            )}
            onRemoveExisting={(att) => setRemovedDocuments((prev) => [...prev, att])}
            files={documentFiles}
            onFilesChange={setDocumentFiles}
          />

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

"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
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
import { omitUndefined } from "@/lib/data/firestore-helpers";
import { createInvoice, updateInvoice } from "@/lib/data/invoices";
import { formatCurrency } from "@/lib/format";
import { INVOICE_STATUSES, type Company, type FinanceAttachment, type Invoice } from "@/lib/types";

const lineItemSchema = z.object({
  description: z.string().min(1, "Required"),
  quantity: z
    .string()
    .min(1, "Required")
    .refine((v) => !isNaN(Number(v)) && Number(v) > 0, "Must be > 0"),
  unitPrice: z
    .string()
    .min(1, "Required")
    .refine((v) => !isNaN(Number(v)) && Number(v) >= 0, "Must be ≥ 0"),
});

const schema = z.object({
  companyId: z.string().min(1, "Pick a company"),
  invoiceNumber: z.string().min(1, "Required"),
  clientName: z.string().min(1, "Required"),
  status: z.enum(["draft", "sent", "paid", "overdue", "cancelled"]),
  currency: z.string().min(1),
  issuedDate: z.string().min(1),
  dueDate: z.string().min(1),
  note: z.string().optional(),
  lineItems: z.array(lineItemSchema).min(1, "Add at least one line item"),
});

type FormValues = z.infer<typeof schema>;

function nextInvoiceNumber() {
  return `INV-${Date.now().toString().slice(-6)}`;
}

export function InvoiceFormDialog({
  open,
  onOpenChange,
  workspaceId,
  companies,
  invoice,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  workspaceId: string;
  companies: Company[];
  invoice?: Invoice | null;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [removedAttachments, setRemovedAttachments] = useState<FinanceAttachment[]>([]);
  const isEditing = Boolean(invoice);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      companyId: companies[0]?.id ?? "",
      invoiceNumber: nextInvoiceNumber(),
      clientName: "",
      status: "draft",
      currency: companies[0]?.currency ?? "LKR",
      issuedDate: new Date().toISOString().slice(0, 10),
      dueDate: new Date().toISOString().slice(0, 10),
      note: "",
      lineItems: [{ description: "", quantity: "1", unitPrice: "0" }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "lineItems" });
  const lineItems = watch("lineItems");
  const total = lineItems.reduce(
    (sum, li) => sum + (Number(li.quantity) || 0) * (Number(li.unitPrice) || 0),
    0
  );

  useEffect(() => {
    if (!open) return;
    setAttachmentFiles([]);
    setRemovedAttachments([]);
    if (invoice) {
      reset({
        companyId: invoice.companyId,
        invoiceNumber: invoice.invoiceNumber,
        clientName: invoice.clientName,
        status: invoice.status,
        currency: invoice.currency,
        issuedDate: new Date(invoice.issuedDate).toISOString().slice(0, 10),
        dueDate: new Date(invoice.dueDate).toISOString().slice(0, 10),
        note: invoice.note ?? "",
        lineItems: invoice.lineItems.length
          ? invoice.lineItems.map((li) => ({
              description: li.description,
              quantity: String(li.quantity),
              unitPrice: String(li.unitPrice),
            }))
          : [{ description: "", quantity: "1", unitPrice: "0" }],
      });
    } else {
      reset({
        companyId: companies[0]?.id ?? "",
        invoiceNumber: nextInvoiceNumber(),
        clientName: "",
        status: "draft",
        currency: companies[0]?.currency ?? "LKR",
        issuedDate: new Date().toISOString().slice(0, 10),
        dueDate: new Date().toISOString().slice(0, 10),
        note: "",
        lineItems: [{ description: "", quantity: "1", unitPrice: "0" }],
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, invoice]);

  /** Uploads every newly staged file, drops any existing attachment the
   * user removed (best-effort Cloudinary cleanup - a hiccup there shouldn't
   * block saving the invoice), and returns the full resulting list. */
  async function resolveAttachments(): Promise<FinanceAttachment[]> {
    const uploaded = await Promise.all(
      attachmentFiles.map(async (file) => {
        const result = await uploadDocumentToCloudinary(file, `founderos/${workspaceId}/invoices`);
        return {
          url: result.url,
          publicId: result.publicId,
          resourceType: result.resourceType as FinanceAttachment["resourceType"],
          name: file.name,
          size: file.size,
        };
      })
    );
    for (const att of removedAttachments) {
      deleteCloudinaryAsset(att.publicId, att.resourceType).catch(() => {});
    }
    const kept = (invoice?.attachments ?? []).filter(
      (att) => !removedAttachments.some((r) => r.publicId === att.publicId)
    );
    return [...kept, ...uploaded];
  }

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      const issuedDate = new Date(`${values.issuedDate}T00:00:00`).getTime();
      const dueDate = new Date(`${values.dueDate}T00:00:00`).getTime();
      const lineItems = values.lineItems.map((li) => ({
        description: li.description,
        quantity: Number(li.quantity),
        unitPrice: Number(li.unitPrice),
      }));
      const amount = lineItems.reduce((sum, li) => sum + li.quantity * li.unitPrice, 0);
      const attachments = await resolveAttachments();
      if (isEditing && invoice) {
        await updateInvoice(workspaceId, invoice.id, omitUndefined({
          companyId: values.companyId,
          invoiceNumber: values.invoiceNumber,
          clientName: values.clientName,
          status: values.status,
          lineItems,
          amount,
          currency: values.currency,
          issuedDate,
          dueDate,
          note: values.note || undefined,
          attachments,
        }));
        toast.success("Invoice updated");
      } else {
        await createInvoice(workspaceId, omitUndefined({
          companyId: values.companyId,
          invoiceNumber: values.invoiceNumber,
          clientName: values.clientName,
          status: values.status,
          lineItems,
          amount,
          currency: values.currency,
          issuedDate,
          dueDate,
          note: values.note || undefined,
          attachments,
        }));
        toast.success("Invoice created");
      }
      onOpenChange(false);
    } catch {
      toast.error("Couldn't save the invoice. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit invoice" : "New invoice"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="max-h-[75vh] space-y-4 overflow-y-auto pr-1">
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
              <Label htmlFor="invoiceNumber">Invoice #</Label>
              <Input id="invoiceNumber" {...register("invoiceNumber")} />
              {errors.invoiceNumber && (
                <p className="text-xs text-danger">{errors.invoiceNumber.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="clientName">Client name</Label>
            <Input id="clientName" placeholder="Client or company name" {...register("clientName")} />
            {errors.clientName && <p className="text-xs text-danger">{errors.clientName.message}</p>}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={watch("status")}
                onValueChange={(v) => setValue("status", v as FormValues["status"])}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(v: string) => INVOICE_STATUSES.find((s) => s.value === v)?.label ?? v}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {INVOICE_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Issued</Label>
              <DatePicker value={watch("issuedDate")} onChange={(v) => setValue("issuedDate", v)} />
            </div>
            <div className="space-y-1.5">
              <Label>Due</Label>
              <DatePicker
                value={watch("dueDate")}
                onChange={(v) => setValue("dueDate", v)}
                fromDate={watch("issuedDate") ? new Date(watch("issuedDate")) : undefined}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="currency">Currency</Label>
            <Input id="currency" maxLength={3} className="w-24 uppercase" {...register("currency")} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Line items</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => append({ description: "", quantity: "1", unitPrice: "0" })}
              >
                <Plus className="size-3.5" />
                Add row
              </Button>
            </div>
            <div className="space-y-2 rounded-lg border border-border p-2.5">
              {fields.map((field, index) => (
                <div key={field.id} className="grid grid-cols-[1fr_4.5rem_5.5rem_1.75rem] gap-2">
                  <Input
                    placeholder="Description"
                    {...register(`lineItems.${index}.description` as const)}
                  />
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="Qty"
                    {...register(`lineItems.${index}.quantity` as const)}
                  />
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Unit price"
                    {...register(`lineItems.${index}.unitPrice` as const)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 self-center text-muted-foreground-2 hover:text-danger"
                    disabled={fields.length === 1}
                    onClick={() => remove(index)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))}
            </div>
            {errors.lineItems && !Array.isArray(errors.lineItems) && (
              <p className="text-xs text-danger">{errors.lineItems.message}</p>
            )}
            <div className="flex items-center justify-end gap-2 text-sm">
              <span className="text-muted-foreground">Total</span>
              <span className="font-semibold">{formatCurrency(total, watch("currency"))}</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="note">Note (optional)</Label>
            <Textarea id="note" placeholder="Payment terms, thank-you note…" {...register("note")} />
          </div>

          <AttachmentField
            label="Attachments (optional)"
            existing={(invoice?.attachments ?? []).filter(
              (att) => !removedAttachments.some((r) => r.publicId === att.publicId)
            )}
            onRemoveExisting={(att) => setRemovedAttachments((prev) => [...prev, att])}
            files={attachmentFiles}
            onFilesChange={setAttachmentFiles}
          />

          <DialogFooter className="sticky bottom-0">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : isEditing ? "Save changes" : "Create invoice"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

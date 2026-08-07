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
import { useContacts } from "@/lib/data/contacts";
import { createDeal, deleteDeal, updateDeal } from "@/lib/data/deals";
import { omitUndefined } from "@/lib/data/firestore-helpers";
import { DEAL_STAGES, type Deal } from "@/lib/types";
import { useWorkspace } from "@/lib/workspace/workspace-provider";

const schema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  companyId: z.string().min(1, "Pick a company"),
  contactId: z.string().optional(),
  value: z
    .string()
    .min(1, "Value is required")
    .refine((v) => !Number.isNaN(Number(v)) && Number(v) >= 0, "Enter a valid amount"),
  currency: z.string().min(1),
  stage: z.enum(["lead", "qualified", "proposal", "negotiation", "won", "lost"]),
  probability: z
    .string()
    .optional()
    .refine(
      (v) => !v || (!Number.isNaN(Number(v)) && Number(v) >= 0 && Number(v) <= 100),
      "Enter 0-100"
    ),
  expectedCloseDate: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

function toDateInput(ms: number | null | undefined) {
  if (!ms) return "";
  return new Date(ms).toISOString().slice(0, 10);
}

export function DealFormDialog({
  open,
  onOpenChange,
  deal,
  defaultCompanyId,
  defaultStage,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  deal?: Deal | null;
  defaultCompanyId?: string;
  defaultStage?: Deal["stage"];
}) {
  const { workspace } = useWorkspace();
  const { data: companies } = useCompanies(workspace?.id ?? null);
  const [submitting, setSubmitting] = useState(false);
  const isEditing = !!deal;

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
      title: "",
      companyId: defaultCompanyId ?? "",
      contactId: "",
      value: "0",
      currency: "USD",
      stage: defaultStage ?? "lead",
      probability: "",
      expectedCloseDate: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    if (deal) {
      reset({
        title: deal.title,
        companyId: deal.companyId,
        contactId: deal.contactId ?? "",
        value: String(deal.value),
        currency: deal.currency,
        stage: deal.stage,
        probability: deal.probability != null ? String(deal.probability) : "",
        expectedCloseDate: toDateInput(deal.expectedCloseDate),
        notes: deal.notes ?? "",
      });
    } else {
      reset({
        title: "",
        companyId: defaultCompanyId ?? "",
        contactId: "",
        value: "0",
        currency: "USD",
        stage: defaultStage ?? "lead",
        probability: "",
        expectedCloseDate: "",
        notes: "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, deal]);

  const companyId = watch("companyId");
  const { data: contacts } = useContacts(workspace?.id ?? null, companyId || undefined);

  async function onSubmit(values: FormValues) {
    if (!workspace) return;
    setSubmitting(true);
    try {
      const payload = omitUndefined({
        companyId: values.companyId,
        contactId: values.contactId || undefined,
        title: values.title,
        value: Number(values.value),
        currency: values.currency,
        stage: values.stage,
        probability: values.probability ? Number(values.probability) : undefined,
        expectedCloseDate: values.expectedCloseDate
          ? new Date(values.expectedCloseDate).getTime()
          : null,
        notes: values.notes || undefined,
      });
      if (isEditing && deal) {
        await updateDeal(workspace.id, deal.id, payload);
        toast.success("Deal updated");
      } else {
        await createDeal(workspace.id, payload);
        toast.success("Deal created");
      }
      reset();
      onOpenChange(false);
    } catch {
      toast.error(`Couldn't ${isEditing ? "update" : "create"} the deal. Try again.`);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!workspace || !deal) return;
    setSubmitting(true);
    try {
      await deleteDeal(workspace.id, deal.id);
      toast.success("Deal deleted");
      onOpenChange(false);
    } catch {
      toast.error("Couldn't delete the deal. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit deal" : "New deal"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input id="title" placeholder="Enterprise contract" autoFocus {...register("title")} />
            {errors.title && <p className="text-xs text-danger">{errors.title.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Company</Label>
              <Select
                value={companyId}
                onValueChange={(v) => {
                  setValue("companyId", v ?? "");
                  setValue("contactId", "");
                }}
              >
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
              <Label>Contact (optional)</Label>
              <Select
                value={watch("contactId")}
                onValueChange={(v) => setValue("contactId", v ?? "")}
                disabled={!companyId}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="No contact">
                    {(v: string) => contacts.find((c) => c.id === v)?.name ?? "No contact"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {contacts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="value">Value</Label>
              <Input id="value" type="number" min={0} step="1" {...register("value")} />
              {errors.value && <p className="text-xs text-danger">{errors.value.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="currency">Currency</Label>
              <Input
                id="currency"
                placeholder="USD"
                maxLength={3}
                className="uppercase"
                {...register("currency")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="probability">Probability %</Label>
              <Input
                id="probability"
                type="number"
                min={0}
                max={100}
                step="1"
                {...register("probability")}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Stage</Label>
              <Select
                value={watch("stage")}
                onValueChange={(v) => setValue("stage", v as FormValues["stage"])}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(v: FormValues["stage"]) =>
                      DEAL_STAGES.find((s) => s.value === v)?.label ?? v
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {DEAL_STAGES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="expectedCloseDate">Expected close</Label>
              <Input id="expectedCloseDate" type="date" {...register("expectedCloseDate")} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea id="notes" rows={3} {...register("notes")} />
          </div>

          <DialogFooter>
            {isEditing && (
              <Button
                type="button"
                variant="ghost"
                className="text-danger hover:text-danger sm:mr-auto"
                disabled={submitting}
                onClick={handleDelete}
              >
                Delete
              </Button>
            )}
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : isEditing ? "Save changes" : "Create deal"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

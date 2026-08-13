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
import { useAuth } from "@/lib/auth/auth-provider";
import { useCompanies } from "@/lib/data/companies";
import { useContacts } from "@/lib/data/contacts";
import { addDealActivity, createDeal } from "@/lib/data/deals";
import { omitUndefined } from "@/lib/data/firestore-helpers";
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

const DEFAULT_VALUES: FormValues = {
  title: "",
  companyId: "",
  contactId: "",
  value: "0",
  currency: "LKR",
  probability: "",
  expectedCloseDate: "",
  notes: "",
};

/**
 * Quick-add for a new deal - deliberately just the essentials (title,
 * company/contact, value, probability, close date). Everything else
 * (owner, source, exit criteria, next step, activity) lives in
 * DealDetailSheet, which opens right after creating and is where a deal
 * actually gets fleshed out and edited going forward.
 */
export function DealFormDialog({
  open,
  onOpenChange,
  defaultCompanyId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultCompanyId?: string;
  /** Called with the new deal's id right after creation, so the caller can
   * open DealDetailSheet on it immediately. */
  onCreated?: (dealId: string) => void;
}) {
  const { workspace } = useWorkspace();
  const { user } = useAuth();
  const { data: companies } = useCompanies(workspace?.id ?? null);
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
    defaultValues: { ...DEFAULT_VALUES, companyId: defaultCompanyId ?? "" },
  });

  useEffect(() => {
    if (!open) return;
    reset({ ...DEFAULT_VALUES, companyId: defaultCompanyId ?? "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultCompanyId]);

  const companyId = watch("companyId");
  const { data: contacts } = useContacts(workspace?.id ?? null, companyId || undefined);

  async function onSubmit(values: FormValues) {
    if (!workspace || !user) return;
    setSubmitting(true);
    try {
      const payload = omitUndefined({
        companyId: values.companyId,
        contactId: values.contactId || undefined,
        title: values.title,
        value: Number(values.value),
        currency: values.currency,
        stage: "prospecting" as const,
        probability: values.probability ? Number(values.probability) : undefined,
        expectedCloseDate: values.expectedCloseDate
          ? new Date(values.expectedCloseDate).getTime()
          : null,
      });
      const ref = await createDeal(workspace.id, payload, user.uid);
      if (values.notes?.trim()) {
        await addDealActivity(workspace.id, {
          dealId: ref.id,
          type: "note",
          text: values.notes.trim(),
          authorId: user.uid,
        });
      }
      toast.success("Deal created");
      reset();
      onOpenChange(false);
      onCreated?.(ref.id);
    } catch {
      toast.error("Couldn't create the deal. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New deal</DialogTitle>
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
                placeholder="LKR"
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

          <div className="space-y-1.5">
            <Label>Expected close</Label>
            <DatePicker
              value={watch("expectedCloseDate")}
              onChange={(v) => setValue("expectedCloseDate", v)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea id="notes" rows={3} {...register("notes")} />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating…" : "Create deal"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

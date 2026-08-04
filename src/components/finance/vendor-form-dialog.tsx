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
import { omitUndefined } from "@/lib/data/firestore-helpers";
import { createVendor, updateVendor } from "@/lib/data/vendors";
import type { Company, Vendor } from "@/lib/types";

const schema = z.object({
  companyId: z.string().min(1, "Pick a company"),
  name: z.string().min(1, "Name is required"),
  category: z.string().optional(),
  contactEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  contactPhone: z.string().optional(),
  website: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function VendorFormDialog({
  open,
  onOpenChange,
  workspaceId,
  companies,
  vendor,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  workspaceId: string;
  companies: Company[];
  vendor?: Vendor | null;
}) {
  const [submitting, setSubmitting] = useState(false);
  const isEditing = Boolean(vendor);
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
      name: "",
      category: "",
      contactEmail: "",
      contactPhone: "",
      website: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    if (vendor) {
      reset({
        companyId: vendor.companyId,
        name: vendor.name,
        category: vendor.category ?? "",
        contactEmail: vendor.contactEmail ?? "",
        contactPhone: vendor.contactPhone ?? "",
        website: vendor.website ?? "",
        notes: vendor.notes ?? "",
      });
    } else {
      reset({
        companyId: companies[0]?.id ?? "",
        name: "",
        category: "",
        contactEmail: "",
        contactPhone: "",
        website: "",
        notes: "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, vendor]);

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      const payload = omitUndefined({
        companyId: values.companyId,
        name: values.name,
        category: values.category || undefined,
        contactEmail: values.contactEmail || undefined,
        contactPhone: values.contactPhone || undefined,
        website: values.website || undefined,
        notes: values.notes || undefined,
      });
      if (isEditing && vendor) {
        await updateVendor(workspaceId, vendor.id, payload);
        toast.success("Vendor updated");
      } else {
        await createVendor(workspaceId, payload);
        toast.success("Vendor added");
      }
      onOpenChange(false);
    } catch {
      toast.error("Couldn't save the vendor. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit vendor" : "New vendor"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" placeholder="Vendor or supplier name" autoFocus {...register("name")} />
            {errors.name && <p className="text-xs text-danger">{errors.name.message}</p>}
          </div>

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
            <Label htmlFor="category">Category (optional)</Label>
            <Input id="category" placeholder="Software, contractor, supplier…" {...register("category")} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="contactEmail">Email (optional)</Label>
              <Input id="contactEmail" type="email" placeholder="hello@vendor.com" {...register("contactEmail")} />
              {errors.contactEmail && (
                <p className="text-xs text-danger">{errors.contactEmail.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contactPhone">Phone (optional)</Label>
              <Input id="contactPhone" placeholder="+1 555…" {...register("contactPhone")} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="website">Website (optional)</Label>
            <Input id="website" placeholder="https://…" {...register("website")} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea id="notes" placeholder="Anything worth remembering" {...register("notes")} />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : isEditing ? "Save changes" : "Add vendor"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

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
import { useCompanies } from "@/lib/data/companies";
import { createContact, updateContact } from "@/lib/data/contacts";
import { omitUndefined } from "@/lib/data/firestore-helpers";
import type { Contact } from "@/lib/types";
import { useWorkspace } from "@/lib/workspace/workspace-provider";

const CONTACT_STATUSES: { value: "active" | "inactive"; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

const schema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  companyId: z.string().min(1, "Pick a company"),
  title: z.string().optional(),
  email: z.string().email("Enter a valid email").optional().or(z.literal("")),
  phone: z.string().optional(),
  status: z.enum(["active", "inactive"]),
  lastContactedAt: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

function toDateInput(ms: number | null | undefined) {
  if (!ms) return "";
  return new Date(ms).toISOString().slice(0, 10);
}

export function ContactFormDialog({
  open,
  onOpenChange,
  contact,
  defaultCompanyId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contact?: Contact | null;
  defaultCompanyId?: string;
}) {
  const { workspace } = useWorkspace();
  const { data: companies } = useCompanies(workspace?.id ?? null);
  const [submitting, setSubmitting] = useState(false);
  const isEditing = !!contact;

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
      name: "",
      companyId: defaultCompanyId ?? "",
      title: "",
      email: "",
      phone: "",
      status: "active",
      lastContactedAt: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    if (contact) {
      reset({
        name: contact.name,
        companyId: contact.companyId,
        title: contact.title ?? "",
        email: contact.email ?? "",
        phone: contact.phone ?? "",
        status: contact.status,
        lastContactedAt: toDateInput(contact.lastContactedAt),
        notes: contact.notes ?? "",
      });
    } else {
      reset({
        name: "",
        companyId: defaultCompanyId ?? "",
        title: "",
        email: "",
        phone: "",
        status: "active",
        lastContactedAt: "",
        notes: "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, contact]);

  async function onSubmit(values: FormValues) {
    if (!workspace) return;
    setSubmitting(true);
    try {
      const payload = omitUndefined({
        companyId: values.companyId,
        name: values.name,
        title: values.title || undefined,
        email: values.email || undefined,
        phone: values.phone || undefined,
        status: values.status,
        lastContactedAt: values.lastContactedAt
          ? new Date(values.lastContactedAt).getTime()
          : null,
        notes: values.notes || undefined,
      });
      if (isEditing && contact) {
        await updateContact(workspace.id, contact.id, payload);
        toast.success("Contact updated");
      } else {
        await createContact(workspace.id, payload);
        toast.success("Contact created");
      }
      reset();
      onOpenChange(false);
    } catch {
      toast.error(`Couldn't ${isEditing ? "update" : "create"} the contact. Try again.`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit contact" : "New contact"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" placeholder="Jane Doe" autoFocus {...register("name")} />
              {errors.name && <p className="text-xs text-danger">{errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="title">Title (optional)</Label>
              <Input id="title" placeholder="VP of Sales" {...register("title")} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Company</Label>
            <Select
              value={watch("companyId")}
              onValueChange={(v) => setValue("companyId", v ?? "")}
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email (optional)</Label>
              <Input id="email" type="email" placeholder="jane@acme.com" {...register("email")} />
              {errors.email && <p className="text-xs text-danger">{errors.email.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone (optional)</Label>
              <Input id="phone" placeholder="+1 555 000 0000" {...register("phone")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={watch("status")}
                onValueChange={(v) => setValue("status", v as FormValues["status"])}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(v: FormValues["status"]) =>
                      CONTACT_STATUSES.find((s) => s.value === v)?.label ?? v
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {CONTACT_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Last contacted (optional)</Label>
              <DatePicker value={watch("lastContactedAt")} onChange={(v) => setValue("lastContactedAt", v)} />
            </div>
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
              {submitting ? "Saving…" : isEditing ? "Save changes" : "Create contact"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

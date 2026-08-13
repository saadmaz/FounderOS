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
import { useAuth } from "@/lib/auth/auth-provider";
import { useCompanies } from "@/lib/data/companies";
import { addContactActivity, createContact } from "@/lib/data/contacts";
import { omitUndefined } from "@/lib/data/firestore-helpers";
import { useWorkspace } from "@/lib/workspace/workspace-provider";

const schema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  companyId: z.string().min(1, "Pick a company"),
  title: z.string().optional(),
  email: z.string().email("Enter a valid email").optional().or(z.literal("")),
  phone: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const DEFAULT_VALUES: FormValues = {
  name: "",
  companyId: "",
  title: "",
  email: "",
  phone: "",
  notes: "",
};

/**
 * Quick-add for a new contact - just the essentials (name, company, title,
 * email, phone). LinkedIn, lead source, status, timeline, tasks, documents,
 * and linked deals all live in ContactDetailSheet, which is where a
 * contact actually gets fleshed out and edited going forward.
 */
export function ContactFormDialog({
  open,
  onOpenChange,
  defaultCompanyId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultCompanyId?: string;
  /** Called with the new contact's id right after creation, so the caller
   * can open ContactDetailSheet on it immediately. */
  onCreated?: (contactId: string) => void;
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

  async function onSubmit(values: FormValues) {
    if (!workspace || !user) return;
    setSubmitting(true);
    try {
      const payload = omitUndefined({
        companyId: values.companyId,
        name: values.name,
        title: values.title || undefined,
        email: values.email || undefined,
        phone: values.phone || undefined,
        status: "active" as const,
      });
      const ref = await createContact(workspace.id, payload, user.uid);
      if (values.notes?.trim()) {
        await addContactActivity(workspace.id, {
          contactId: ref.id,
          type: "note",
          text: values.notes.trim(),
          authorId: user.uid,
        });
      }
      toast.success("Contact created");
      reset();
      onOpenChange(false);
      onCreated?.(ref.id);
    } catch {
      toast.error("Couldn't create the contact. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New contact</DialogTitle>
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
              <Label htmlFor="phone">Mobile number (optional)</Label>
              <Input id="phone" placeholder="+1 555 000 0000" {...register("phone")} />
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
              {submitting ? "Creating…" : "Create contact"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

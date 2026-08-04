"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
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
import { createLearningItem } from "@/lib/data/learning";
import { LEARNING_TYPES } from "@/lib/types";
import { useWorkspace } from "@/lib/workspace/workspace-provider";

const schema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  type: z.enum(["book", "course", "article", "podcast", "video", "other"]),
  url: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
});

type FormValues = z.infer<typeof schema>;

export function LearningFormDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { workspace } = useWorkspace();
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
    defaultValues: {
      title: "",
      type: "book",
      url: "",
      notes: "",
    },
  });

  async function onSubmit(values: FormValues) {
    if (!workspace) return;
    setSubmitting(true);
    try {
      await createLearningItem(workspace.id, omitUndefined({
        title: values.title,
        type: values.type,
        status: "queued",
        url: values.url || undefined,
        notes: values.notes || undefined,
      }));
      toast.success(`${values.title} added`);
      reset();
      onOpenChange(false);
    } catch {
      toast.error("Couldn't add the item. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New learning item</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              placeholder="Zero to One"
              autoFocus
              {...register("title")}
            />
            {errors.title && <p className="text-xs text-danger">{errors.title.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={watch("type")} onValueChange={(v) => setValue("type", v as FormValues["type"])}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEARNING_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="url">Link (optional)</Label>
            <Input id="url" placeholder="https://…" {...register("url")} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea id="notes" placeholder="Why this, what to look for…" rows={3} {...register("notes")} />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Adding…" : "Add item"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

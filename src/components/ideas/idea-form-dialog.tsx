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
import { omitUndefined } from "@/lib/data/firestore-helpers";
import { createIdea, updateIdea } from "@/lib/data/ideas";
import type { Idea } from "@/lib/types";
import { useWorkspace } from "@/lib/workspace/workspace-provider";

const NO_COMPANY = "none";
const NO_SCORE = "unset";
const SCORE_OPTIONS = ["1", "2", "3", "4", "5"];

const schema = z.object({
  title: z.string().min(1, "Title is required").max(150),
  description: z.string().optional(),
  companyId: z.string().optional(),
  tags: z.string().optional(),
  impact: z.string().optional(),
  effort: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

function defaultsFor(idea?: Idea | null, defaultCompanyId?: string): FormValues {
  if (idea) {
    return {
      title: idea.title,
      description: idea.description ?? "",
      companyId: idea.companyId ?? NO_COMPANY,
      tags: idea.tags && idea.tags.length > 0 ? idea.tags.join(", ") : "",
      impact: idea.impact !== undefined ? String(idea.impact) : NO_SCORE,
      effort: idea.effort !== undefined ? String(idea.effort) : NO_SCORE,
    };
  }
  return {
    title: "",
    description: "",
    companyId: defaultCompanyId ?? NO_COMPANY,
    tags: "",
    impact: NO_SCORE,
    effort: NO_SCORE,
  };
}

export function IdeaFormDialog({
  open,
  onOpenChange,
  idea,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  idea?: Idea | null;
}) {
  const { workspace } = useWorkspace();
  const { user } = useAuth();
  const { data: companies } = useCompanies(workspace?.id ?? null);
  const [submitting, setSubmitting] = useState(false);
  const isEditing = Boolean(idea);
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultsFor(idea),
  });

  useEffect(() => {
    if (!open) return;
    reset(defaultsFor(idea));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, idea]);

  async function onSubmit(values: FormValues) {
    if (!workspace || !user) return;
    setSubmitting(true);
    try {
      const tags = values.tags
        ? values.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : undefined;
      const payload = omitUndefined({
        title: values.title,
        description: values.description || undefined,
        companyId: values.companyId && values.companyId !== NO_COMPANY ? values.companyId : undefined,
        tags: tags && tags.length > 0 ? tags : undefined,
        impact: values.impact && values.impact !== NO_SCORE ? Number(values.impact) : undefined,
        effort: values.effort && values.effort !== NO_SCORE ? Number(values.effort) : undefined,
      });
      if (isEditing && idea) {
        await updateIdea(workspace.id, idea.id, payload);
        toast.success("Idea updated");
      } else {
        await createIdea(workspace.id, { ...payload, createdBy: user.uid });
        toast.success("Idea added");
      }
      reset();
      onOpenChange(false);
    } catch {
      toast.error(isEditing ? "Couldn't update the idea. Try again." : "Couldn't create the idea. Try again.");
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
          <DialogTitle>{isEditing ? "Edit idea" : "New idea"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input id="title" placeholder="Add dark mode toggle" autoFocus {...register("title")} />
            {errors.title && <p className="text-xs text-danger">{errors.title.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea id="description" rows={3} placeholder="What's the idea?" {...register("description")} />
          </div>

          <div className="space-y-1.5">
            <Label>Company (optional)</Label>
            <Select value={watch("companyId")} onValueChange={(v) => setValue("companyId", v ?? NO_COMPANY)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="No company">
                  {(v: string) =>
                    v === NO_COMPANY ? "No company" : companies.find((c) => c.id === v)?.name ?? "No company"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_COMPANY}>No company</SelectItem>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Impact (optional)</Label>
              <Select value={watch("impact") ?? NO_SCORE} onValueChange={(v) => setValue("impact", v ?? NO_SCORE)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="1-5">{(v: string) => (v === NO_SCORE ? "1-5" : v)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_SCORE}>Unset</SelectItem>
                  {SCORE_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Effort (optional)</Label>
              <Select value={watch("effort") ?? NO_SCORE} onValueChange={(v) => setValue("effort", v ?? NO_SCORE)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="1-5">{(v: string) => (v === NO_SCORE ? "1-5" : v)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_SCORE}>Unset</SelectItem>
                  {SCORE_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tags">Tags (optional, comma-separated)</Label>
            <Input id="tags" placeholder="growth, ux, quick-win" {...register("tags")} />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : isEditing ? "Save changes" : "Add idea"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

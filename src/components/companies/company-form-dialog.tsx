"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AtSign, Briefcase, Camera, Globe, Link2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { uploadImageToCloudinary } from "@/lib/cloudinary";
import { createCompany, updateCompany } from "@/lib/data/companies";
import { omitUndefined } from "@/lib/data/firestore-helpers";
import type { Company } from "@/lib/types";
import { useWorkspace } from "@/lib/workspace/workspace-provider";

const COLORS = ["#2563EB", "#8B5CF6", "#06B6D4", "#EC4899", "#F97316", "#22C55E", "#F59E0B", "#71717A"];

const urlField = z
  .string()
  .optional()
  .refine((v) => !v || /^https?:\/\/.+/i.test(v), "Include http:// or https://");

const schema = z.object({
  // Step 1 — basics
  name: z.string().min(1, "Name is required").max(100),
  legalName: z.string().max(150).optional(),
  industry: z.string().optional(),
  type: z.enum(["startup", "client", "agency", "personal", "investment"]),
  stage: z.enum(["idea", "pre-launch", "launched", "growth", "scaling", "mature"]),
  currency: z.string().min(1, "Currency is required").max(3),
  // Step 2 — branding
  logoUrl: z.string().optional(),
  color: z.string(),
  description: z.string().max(500).optional(),
  // Step 3 — links & details
  website: urlField,
  linkedin: urlField,
  twitter: urlField,
  instagram: urlField,
  other: urlField,
  founder: z.string().max(100).optional(),
  startedAt: z.string().optional(),
  notes: z.string().max(1000).optional(),
});

type FormValues = z.infer<typeof schema>;

const STEPS: { title: string; description: string; fields: (keyof FormValues)[] }[] = [
  {
    title: "Basics",
    description: "What is this company, in a nutshell?",
    fields: ["name", "legalName", "industry", "type", "stage", "currency"],
  },
  {
    title: "Branding",
    description: "Give it a face — this shows up everywhere in the app.",
    fields: ["logoUrl", "color", "description"],
  },
  {
    title: "Links & details",
    description: "Optional, but handy to have on file.",
    fields: ["website", "linkedin", "twitter", "instagram", "other", "founder", "startedAt", "notes"],
  },
];

function defaultsFor(company?: Company | null): FormValues {
  return {
    name: company?.name ?? "",
    legalName: company?.legalName ?? "",
    industry: company?.industry ?? "",
    type: company?.type ?? "startup",
    stage: company?.stage ?? "idea",
    currency: company?.currency ?? "USD",
    logoUrl: company?.logoUrl ?? "",
    color: company?.color ?? COLORS[0],
    description: company?.description ?? "",
    website: company?.links?.website ?? "",
    linkedin: company?.links?.linkedin ?? "",
    twitter: company?.links?.twitter ?? "",
    instagram: company?.links?.instagram ?? "",
    other: company?.links?.other ?? "",
    founder: company?.founder ?? "",
    startedAt: company?.startedAt ? new Date(company.startedAt).toISOString().slice(0, 10) : "",
    notes: company?.notes ?? "",
  };
}

export function CompanyFormDialog({
  open,
  onOpenChange,
  company,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  company?: Company | null;
}) {
  const { workspace } = useWorkspace();
  const isEditing = Boolean(company);
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    trigger,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultsFor(company),
  });

  useEffect(() => {
    if (!open) return;
    reset(defaultsFor(company));
    setStep(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, company]);

  const lastStep = STEPS.length - 1;

  async function goNext() {
    const valid = await trigger(STEPS[step].fields);
    if (valid) setStep((s) => Math.min(s + 1, lastStep));
  }

  function goBack() {
    if (step === 0) {
      onOpenChange(false);
    } else {
      setStep((s) => s - 1);
    }
  }

  // The form never relies on native submission (no button in it has
  // type="submit") - Enter is handled here explicitly for every step so it
  // can't race with the footer button swapping behavior between steps.
  function handleFormKeyDown(e: React.KeyboardEvent<HTMLFormElement>) {
    const target = e.target as HTMLElement;
    if (e.key !== "Enter" || target.tagName === "TEXTAREA") return;
    e.preventDefault();
    if (step < lastStep) {
      void goNext();
    } else {
      void handleSubmit(onSubmit)();
    }
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !workspace) return;
    setUploadingLogo(true);
    try {
      const url = await uploadImageToCloudinary(file, `founderos/${workspace.id}/logos`);
      setValue("logoUrl", url, { shouldValidate: true });
    } catch {
      toast.error("Couldn't upload the logo. Try again.");
    } finally {
      setUploadingLogo(false);
    }
  }

  async function onSubmit(values: FormValues) {
    if (!workspace) return;
    setSubmitting(true);
    try {
      const links = omitUndefined({
        website: values.website || undefined,
        linkedin: values.linkedin || undefined,
        twitter: values.twitter || undefined,
        instagram: values.instagram || undefined,
        other: values.other || undefined,
      });

      const payload = omitUndefined({
        name: values.name,
        legalName: values.legalName || undefined,
        industry: values.industry || undefined,
        type: values.type,
        stage: values.stage,
        currency: values.currency.toUpperCase(),
        color: values.color,
        logoUrl: values.logoUrl || undefined,
        description: values.description || undefined,
        founder: values.founder || undefined,
        startedAt: values.startedAt ? new Date(`${values.startedAt}T00:00:00`).getTime() : undefined,
        notes: values.notes || undefined,
        links: Object.keys(links).length ? links : undefined,
      });

      if (isEditing && company) {
        await updateCompany(workspace.id, company.id, payload);
        toast.success(`${values.name} updated`);
      } else {
        await createCompany(workspace.id, { ...payload, status: "active" });
        toast.success(`${values.name} created`);
      }
      onOpenChange(false);
    } catch {
      toast.error("Couldn't save the company. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const logoUrl = watch("logoUrl");
  const name = watch("name");
  const color = watch("color");

  return (
    <Dialog open={open} onOpenChange={(v) => !submitting && onOpenChange(v)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit company" : "New company"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-1.5">
          <Progress value={((step + 1) / STEPS.length) * 100} />
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-foreground">
              Step {step + 1} of {STEPS.length}: {STEPS[step].title}
            </p>
            <p className="text-xs text-muted-foreground">{STEPS[step].description}</p>
          </div>
        </div>

        <form onSubmit={(e) => e.preventDefault()} onKeyDown={handleFormKeyDown} className="space-y-4">
          {step === 0 && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="name">Name</Label>
                <Input id="name" placeholder="Acme Inc." autoFocus {...register("name")} />
                {errors.name && <p className="text-xs text-danger">{errors.name.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="legalName">Legal name (optional)</Label>
                <Input id="legalName" placeholder="Acme Incorporated LLC" {...register("legalName")} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="industry">Industry (optional)</Label>
                <Input id="industry" placeholder="SaaS, Retail, Consulting…" {...register("industry")} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select value={watch("type")} onValueChange={(v) => setValue("type", v as FormValues["type"])}>
                    <SelectTrigger className="w-full">
                      <SelectValue>{(v: string) => <span className="capitalize">{v}</span>}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {["startup", "client", "agency", "personal", "investment"].map((t) => (
                        <SelectItem key={t} value={t} className="capitalize">
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Stage</Label>
                  <Select value={watch("stage")} onValueChange={(v) => setValue("stage", v as FormValues["stage"])}>
                    <SelectTrigger className="w-full">
                      <SelectValue>{(v: string) => <span className="capitalize">{v.replace("-", " ")}</span>}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {["idea", "pre-launch", "launched", "growth", "scaling", "mature"].map((s) => (
                        <SelectItem key={s} value={s} className="capitalize">
                          {s.replace("-", " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="currency">Currency</Label>
                <Input id="currency" placeholder="USD" maxLength={3} className="uppercase" {...register("currency")} />
                {errors.currency && <p className="text-xs text-danger">{errors.currency.message}</p>}
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <div className="space-y-1.5">
                <Label>Logo (optional)</Label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingLogo}
                    className="group relative rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Avatar size="lg" className="size-14">
                      <AvatarImage src={logoUrl || undefined} />
                      <AvatarFallback
                        className="text-base font-semibold text-white"
                        style={{ backgroundColor: color }}
                      >
                        {name ? name[0]?.toUpperCase() : "?"}
                      </AvatarFallback>
                    </Avatar>
                    <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                      {uploadingLogo ? "…" : "Change"}
                    </span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoChange}
                  />
                  <p className="text-xs text-muted-foreground">
                    {uploadingLogo ? "Uploading…" : "PNG or JPG, square works best."}
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Color</Label>
                <div className="flex gap-2">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setValue("color", c)}
                      className="size-7 rounded-full ring-offset-2 ring-offset-background transition-all"
                      style={{
                        backgroundColor: c,
                        outline: watch("color") === c ? `2px solid ${c}` : "none",
                        outlineOffset: 2,
                      }}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  placeholder="What does this company do?"
                  rows={3}
                  {...register("description")}
                />
                {errors.description && <p className="text-xs text-danger">{errors.description.message}</p>}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="website" className="flex items-center gap-1.5">
                  <Globe className="size-3.5 text-muted-foreground" /> Website
                </Label>
                <Input id="website" placeholder="https://acme.com" {...register("website")} />
                {errors.website && <p className="text-xs text-danger">{errors.website.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="linkedin" className="flex items-center gap-1.5">
                    <Briefcase className="size-3.5 text-muted-foreground" /> LinkedIn
                  </Label>
                  <Input id="linkedin" placeholder="https://linkedin.com/…" {...register("linkedin")} />
                  {errors.linkedin && <p className="text-xs text-danger">{errors.linkedin.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="twitter" className="flex items-center gap-1.5">
                    <AtSign className="size-3.5 text-muted-foreground" /> X / Twitter
                  </Label>
                  <Input id="twitter" placeholder="https://x.com/…" {...register("twitter")} />
                  {errors.twitter && <p className="text-xs text-danger">{errors.twitter.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="instagram" className="flex items-center gap-1.5">
                    <Camera className="size-3.5 text-muted-foreground" /> Instagram
                  </Label>
                  <Input id="instagram" placeholder="https://instagram.com/…" {...register("instagram")} />
                  {errors.instagram && <p className="text-xs text-danger">{errors.instagram.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="other" className="flex items-center gap-1.5">
                    <Link2 className="size-3.5 text-muted-foreground" /> Other link
                  </Label>
                  <Input id="other" placeholder="https://…" {...register("other")} />
                  {errors.other && <p className="text-xs text-danger">{errors.other.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="founder">Founder (optional)</Label>
                  <Input id="founder" placeholder="Jane Doe" {...register("founder")} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="startedAt">Started (optional)</Label>
                  <Input id="startedAt" type="date" {...register("startedAt")} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="notes">Internal notes (optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Anything else worth remembering…"
                  rows={2}
                  {...register("notes")}
                />
              </div>
            </>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={goBack} disabled={submitting}>
              {step === 0 ? "Cancel" : "Back"}
            </Button>
            {step < lastStep ? (
              <Button type="button" onClick={goNext}>
                Continue
              </Button>
            ) : (
              <Button type="button" onClick={() => handleSubmit(onSubmit)()} disabled={submitting || uploadingLogo}>
                {submitting ? "Saving…" : isEditing ? "Save changes" : "Create company"}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

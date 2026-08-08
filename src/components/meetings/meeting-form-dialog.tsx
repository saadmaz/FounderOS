"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { omitUndefined } from "@/lib/data/firestore-helpers";
import { createMeeting, createRecurringMeetings, updateMeeting } from "@/lib/data/meetings";
import { useMembers } from "@/lib/data/members";
import { expandRecurrence, MAX_RECURRENCE_INSTANCES } from "@/lib/recurrence";
import { RECURRENCE_FREQUENCIES, type Meeting } from "@/lib/types";
import { useWorkspace } from "@/lib/workspace/workspace-provider";

const RECURRENCE_UNIT: Record<"daily" | "weekly" | "monthly", string> = {
  daily: "day(s)",
  weekly: "week(s)",
  monthly: "month(s)",
};

const schema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  companyId: z.string().min(1, "Pick a company"),
  scheduledAt: z.string().min(1, "Pick a date and time"),
  durationMinutes: z
    .string()
    .min(1, "Required")
    .refine((v) => Number.isInteger(Number(v)) && Number(v) >= 5 && Number(v) <= 1440, {
      message: "Must be between 5 and 1440 minutes",
    }),
  location: z.string().optional(),
  agenda: z.string().optional(),
  attendeeIds: z.array(z.string()),
  recurrenceFreq: z.enum(["none", "daily", "weekly", "monthly"]),
  recurrenceInterval: z.string(),
  recurrenceEndMode: z.enum(["count", "until"]),
  recurrenceCount: z.string(),
  recurrenceUntil: z.string(),
});

type FormValues = z.infer<typeof schema>;

function toDatetimeLocalValue(ms: number) {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function defaultScheduledAt() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - (d.getMinutes() % 30) + 30, 0, 0);
  return toDatetimeLocalValue(d.getTime());
}

const RECURRENCE_DEFAULTS = {
  recurrenceFreq: "none" as const,
  recurrenceInterval: "1",
  recurrenceEndMode: "count" as const,
  recurrenceCount: "5",
  recurrenceUntil: "",
};

export function MeetingFormDialog({
  open,
  onOpenChange,
  meeting,
  defaultCompanyId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  meeting?: Meeting | null;
  defaultCompanyId?: string;
}) {
  const { workspace } = useWorkspace();
  const { data: companies } = useCompanies(workspace?.id ?? null);
  const { data: members } = useMembers(workspace?.id ?? null);
  const [submitting, setSubmitting] = useState(false);
  const isEditing = Boolean(meeting);

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
      companyId: "",
      scheduledAt: defaultScheduledAt(),
      durationMinutes: "30",
      location: "",
      agenda: "",
      attendeeIds: [],
      ...RECURRENCE_DEFAULTS,
    },
  });

  useEffect(() => {
    if (!open) return;
    if (meeting) {
      // Recurrence is a create-time-only decision (see the Repeat field
      // below, hidden entirely while editing) - always reset to "none"
      // here regardless of whether this instance belongs to a series.
      reset({
        title: meeting.title,
        companyId: meeting.companyId,
        scheduledAt: toDatetimeLocalValue(meeting.scheduledAt),
        durationMinutes: String(meeting.durationMinutes),
        location: meeting.location ?? "",
        agenda: meeting.agenda ?? "",
        attendeeIds: meeting.attendeeIds ?? [],
        ...RECURRENCE_DEFAULTS,
      });
    } else {
      reset({
        title: "",
        companyId: defaultCompanyId ?? companies[0]?.id ?? "",
        scheduledAt: defaultScheduledAt(),
        durationMinutes: "30",
        location: "",
        agenda: "",
        attendeeIds: [],
        ...RECURRENCE_DEFAULTS,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, meeting, defaultCompanyId]);

  const attendeeIds = watch("attendeeIds");
  const recurrenceFreq = watch("recurrenceFreq");
  const recurrenceEndMode = watch("recurrenceEndMode");

  function toggleAttendee(id: string) {
    setValue(
      "attendeeIds",
      attendeeIds.includes(id) ? attendeeIds.filter((a) => a !== id) : [...attendeeIds, id]
    );
  }

  async function onSubmit(values: FormValues) {
    if (!workspace) return;
    setSubmitting(true);
    try {
      const scheduledAt = new Date(values.scheduledAt).getTime();
      const durationMinutes = Number(values.durationMinutes);
      if (isEditing && meeting) {
        await updateMeeting(workspace.id, meeting.id, omitUndefined({
          title: values.title,
          companyId: values.companyId,
          scheduledAt,
          durationMinutes,
          location: values.location || undefined,
          agenda: values.agenda || undefined,
          attendeeIds: values.attendeeIds,
        }));
        toast.success("Meeting updated");
      } else {
        const base = omitUndefined({
          companyId: values.companyId,
          title: values.title,
          durationMinutes,
          location: values.location || undefined,
          agenda: values.agenda || undefined,
          attendeeIds: values.attendeeIds,
          status: "scheduled" as const,
        });

        if (values.recurrenceFreq === "none") {
          await createMeeting(workspace.id, { ...base, scheduledAt });
          toast.success("Meeting scheduled");
        } else {
          const dates = expandRecurrence(scheduledAt, {
            frequency: values.recurrenceFreq,
            interval: Number(values.recurrenceInterval) || 1,
            endMode: values.recurrenceEndMode,
            count: Number(values.recurrenceCount) || 1,
            until: values.recurrenceUntil
              ? new Date(`${values.recurrenceUntil}T23:59:59`).getTime()
              : undefined,
          });
          await createRecurringMeetings(workspace.id, base, dates, {
            frequency: values.recurrenceFreq,
            interval: Number(values.recurrenceInterval) || 1,
          });
          toast.success(`${dates.length} meetings scheduled`);
        }
      }
      onOpenChange(false);
    } catch {
      toast.error(
        isEditing ? "Couldn't update the meeting. Try again." : "Couldn't schedule the meeting. Try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit meeting" : "New meeting"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input id="title" placeholder="Weekly sync" autoFocus {...register("title")} />
            {errors.title && <p className="text-xs text-danger">{errors.title.message}</p>}
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="scheduledAt">Date &amp; time</Label>
              <Input id="scheduledAt" type="datetime-local" {...register("scheduledAt")} />
              {errors.scheduledAt && (
                <p className="text-xs text-danger">{errors.scheduledAt.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="durationMinutes">Duration (min)</Label>
              <Input
                id="durationMinutes"
                type="number"
                min={5}
                step={5}
                {...register("durationMinutes")}
              />
              {errors.durationMinutes && (
                <p className="text-xs text-danger">{errors.durationMinutes.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="location">Location / link (optional)</Label>
            <Input id="location" placeholder="Zoom, office, address…" {...register("location")} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="agenda">Agenda (optional)</Label>
            <Textarea id="agenda" placeholder="What's on the table?" {...register("agenda")} />
          </div>

          <div className="space-y-1.5">
            <Label>Attendees</Label>
            {members.length === 0 ? (
              <p className="text-xs text-muted-foreground">No workspace members yet.</p>
            ) : (
              <div className="max-h-36 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
                {members.map((m) => (
                  <label
                    key={m.id}
                    htmlFor={`attendee-${m.id}`}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-muted"
                  >
                    <Checkbox
                      id={`attendee-${m.id}`}
                      checked={attendeeIds.includes(m.id)}
                      onCheckedChange={() => toggleAttendee(m.id)}
                    />
                    {m.displayName || m.email}
                  </label>
                ))}
              </div>
            )}
          </div>

          {!isEditing && (
            <div className="space-y-1.5">
              <Label>Repeat</Label>
              <Select
                value={recurrenceFreq}
                onValueChange={(v) =>
                  setValue("recurrenceFreq", (v as FormValues["recurrenceFreq"]) ?? "none")
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(v: FormValues["recurrenceFreq"]) =>
                      v === "none"
                        ? "Does not repeat"
                        : (RECURRENCE_FREQUENCIES.find((f) => f.value === v)?.label ?? v)
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Does not repeat</SelectItem>
                  {RECURRENCE_FREQUENCIES.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {recurrenceFreq !== "none" && (
                <div className="space-y-3 rounded-lg border border-border p-3">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Every</span>
                    <Input
                      type="number"
                      min={1}
                      className="w-16"
                      {...register("recurrenceInterval")}
                    />
                    <span className="text-muted-foreground">{RECURRENCE_UNIT[recurrenceFreq]}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Ends</span>
                    <Select
                      value={recurrenceEndMode}
                      onValueChange={(v) =>
                        setValue("recurrenceEndMode", (v as FormValues["recurrenceEndMode"]) ?? "count")
                      }
                    >
                      <SelectTrigger size="sm" className="w-28">
                        <SelectValue>{(v: string) => (v === "count" ? "After" : "On date")}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="count">After</SelectItem>
                        <SelectItem value="until">On date</SelectItem>
                      </SelectContent>
                    </Select>
                    {recurrenceEndMode === "count" ? (
                      <>
                        <Input
                          type="number"
                          min={1}
                          max={MAX_RECURRENCE_INSTANCES}
                          className="w-16"
                          {...register("recurrenceCount")}
                        />
                        <span className="text-muted-foreground">meetings</span>
                      </>
                    ) : (
                      <Input type="date" className="w-40" {...register("recurrenceUntil")} />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground-2">
                    Creates up to {MAX_RECURRENCE_INSTANCES} meetings in the series.
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : isEditing ? "Save changes" : "Schedule meeting"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

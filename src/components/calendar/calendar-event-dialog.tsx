"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth/auth-provider";
import { createCalendarEvent, updateCalendarEvent } from "@/lib/data/calendar-events";
import { useCompanies } from "@/lib/data/companies";
import { omitUndefined } from "@/lib/data/firestore-helpers";
import type { CalendarEvent, CalendarEventType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/lib/workspace/workspace-provider";

export const CALENDAR_EVENT_TYPES: { value: CalendarEventType; label: string }[] = [
  { value: "event", label: "Event" },
  { value: "deadline", label: "Deadline" },
  { value: "reminder", label: "Reminder" },
];

export const CALENDAR_EVENT_TYPE_LABELS: Record<CalendarEventType, string> = {
  event: "Event",
  deadline: "Deadline",
  reminder: "Reminder",
};

export const CALENDAR_EVENT_TYPE_STYLES: Record<CalendarEventType, string> = {
  event: "bg-primary/10 text-primary",
  deadline: "bg-danger/10 text-danger",
  reminder: "bg-warning/10 text-warning",
};

const NO_COMPANY = "none";

const schema = z
  .object({
    title: z.string().min(1, "Title is required").max(200),
    type: z.enum(["event", "deadline", "reminder"]),
    date: z.string().min(1, "Date is required"),
    allDay: z.boolean(),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    companyId: z.string(),
    notes: z.string().optional(),
  })
  .refine((v) => v.allDay || !!v.startTime, {
    message: "Start time is required",
    path: ["startTime"],
  });

type FormValues = z.infer<typeof schema>;

function toDateInput(ms: number) {
  return format(ms, "yyyy-MM-dd");
}
function toTimeInput(ms: number) {
  return format(ms, "HH:mm");
}

function defaultsFor(event?: CalendarEvent | null, defaultDate?: number): FormValues {
  if (event) {
    return {
      title: event.title,
      type: event.type,
      date: toDateInput(event.startsAt),
      allDay: event.allDay,
      startTime: event.allDay ? "" : toTimeInput(event.startsAt),
      endTime: !event.allDay && event.endsAt ? toTimeInput(event.endsAt) : "",
      companyId: event.companyId ?? NO_COMPANY,
      notes: event.notes ?? "",
    };
  }
  const base = defaultDate ?? Date.now();
  return {
    title: "",
    type: "event",
    date: toDateInput(base),
    allDay: false,
    startTime: "09:00",
    endTime: "",
    companyId: NO_COMPANY,
    notes: "",
  };
}

export function CalendarEventDialog({
  open,
  onOpenChange,
  event,
  defaultDate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  event?: CalendarEvent | null;
  defaultDate?: number;
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
    defaultValues: defaultsFor(event, defaultDate),
  });

  useEffect(() => {
    if (open) reset(defaultsFor(event, defaultDate));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, event, defaultDate]);

  const allDay = watch("allDay");
  const companyId = watch("companyId");

  async function onSubmit(values: FormValues) {
    if (!workspace || !user) return;
    setSubmitting(true);
    try {
      const startsAt = values.allDay
        ? new Date(`${values.date}T00:00`).getTime()
        : new Date(`${values.date}T${values.startTime || "09:00"}`).getTime();
      const endsAt =
        !values.allDay && values.endTime
          ? new Date(`${values.date}T${values.endTime}`).getTime()
          : null;

      const payload = omitUndefined({
        title: values.title,
        type: values.type,
        startsAt,
        endsAt,
        allDay: values.allDay,
        companyId: values.companyId === NO_COMPANY ? undefined : values.companyId,
        notes: values.notes || undefined,
      });

      if (event) {
        await updateCalendarEvent(workspace.id, event.id, payload);
        toast.success("Event updated");
      } else {
        await createCalendarEvent(workspace.id, {
          ...payload,
          createdBy: user.uid,
        });
        toast.success("Event created");
      }
      reset();
      onOpenChange(false);
    } catch {
      toast.error(`Couldn't ${event ? "update" : "create"} the event. Try again.`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{event ? "Edit event" : "New event"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input id="title" placeholder="What's happening?" autoFocus {...register("title")} />
            {errors.title && <p className="text-xs text-danger">{errors.title.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select
                value={watch("type")}
                onValueChange={(v) => setValue("type", v as FormValues["type"])}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(v: FormValues["type"]) => CALENDAR_EVENT_TYPE_LABELS[v]}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {CALENDAR_EVENT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Company (optional)</Label>
              <Select
                value={companyId}
                onValueChange={(v) => setValue("companyId", v ?? NO_COMPANY)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="No company">
                    {(v: string) => companies.find((c) => c.id === v)?.name ?? "No company"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_COMPANY}>No company</SelectItem>
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
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
            <Label htmlFor="allDay" className="cursor-pointer">
              All day
            </Label>
            <Switch id="allDay" checked={allDay} onCheckedChange={(v) => setValue("allDay", v)} />
          </div>

          <div className={cn("grid gap-3", allDay ? "grid-cols-1" : "grid-cols-3")}>
            <div className="space-y-1.5">
              <Label htmlFor="date">Date</Label>
              <Input id="date" type="date" {...register("date")} />
              {errors.date && <p className="text-xs text-danger">{errors.date.message}</p>}
            </div>
            {!allDay && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="startTime">Start</Label>
                  <Input id="startTime" type="time" {...register("startTime")} />
                  {errors.startTime && (
                    <p className="text-xs text-danger">{errors.startTime.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="endTime">End (optional)</Label>
                  <Input id="endTime" type="time" {...register("endTime")} />
                </div>
              </>
            )}
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
              {submitting
                ? event
                  ? "Saving…"
                  : "Creating…"
                : event
                  ? "Save changes"
                  : "Create event"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

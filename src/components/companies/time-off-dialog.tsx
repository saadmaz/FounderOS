"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { markTimeOff, startOfDay } from "@/lib/data/time-off";
import { TIME_OFF_REASONS, type TimeOffReason } from "@/lib/types";

const schema = z.object({
  date: z.string().min(1, "Pick a date"),
  reason: z.enum(["vacation", "sick", "holiday", "personal", "other"]),
  note: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function TimeOffDialog({
  open,
  onOpenChange,
  workspaceId,
  companyId,
  memberId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  workspaceId: string;
  companyId: string;
  memberId: string;
}) {
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
    defaultValues: { date: format(new Date(), "yyyy-MM-dd"), reason: "vacation", note: "" },
  });

  useEffect(() => {
    if (open) reset({ date: format(new Date(), "yyyy-MM-dd"), reason: "vacation", note: "" });
  }, [open, reset]);

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      await markTimeOff(workspaceId, {
        companyId,
        memberId,
        date: startOfDay(new Date(`${values.date}T00:00:00`).getTime()),
        reason: values.reason,
        note: values.note || undefined,
      });
      toast.success("Marked as off");
      onOpenChange(false);
    } catch {
      toast.error("Couldn't save that. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Mark a day off</DialogTitle>
          <DialogDescription>Keeps this day out of your worked-hours total.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Date</Label>
            <DatePicker value={watch("date")} onChange={(v) => setValue("date", v)} />
            {errors.date && <p className="text-xs text-danger">{errors.date.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Reason</Label>
            <Select
              value={watch("reason")}
              onValueChange={(v) => v && setValue("reason", v as TimeOffReason)}
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(v: TimeOffReason) => TIME_OFF_REASONS.find((r) => r.value === v)?.label}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {TIME_OFF_REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="note">Note (optional)</Label>
            <Textarea id="note" rows={2} placeholder="Anything worth remembering" {...register("note")} />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : "Mark as off"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

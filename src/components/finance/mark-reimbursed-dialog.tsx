"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
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
import { toDateInputValue } from "@/lib/format";

const todayValue = () => toDateInputValue();

/**
 * Confirms marking one or more expenses reimbursed and lets the date be
 * backdated to when the payout actually happened, instead of always
 * stamping the moment the button is clicked - reimbursements are often
 * recorded a few days after the fact.
 */
export function MarkReimbursedDialog({
  open,
  onOpenChange,
  count,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Number of expenses being marked reimbursed - singular copy at 1. */
  count: number;
  onConfirm: (reimbursedAt: number) => Promise<void>;
}) {
  const [date, setDate] = useState(todayValue);
  const [submitting, setSubmitting] = useState(false);

  // Reset to today each time the dialog opens for a fresh expense/batch,
  // rather than carrying over whatever date was picked last time.
  useEffect(() => {
    if (open) setDate(todayValue());
  }, [open]);

  async function handleConfirm() {
    setSubmitting(true);
    try {
      await onConfirm(new Date(`${date}T00:00:00`).getTime());
      onOpenChange(false);
    } catch {
      toast.error("Couldn't update reimbursement status. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !submitting && onOpenChange(v)}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Mark {count === 1 ? "expense" : `${count} expenses`} reimbursed</DialogTitle>
          <DialogDescription>When did the payout actually happen?</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label>Reimbursed on</Label>
          <DatePicker value={date} onChange={setDate} />
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={submitting}>
            {submitting ? "Marking…" : "Mark reimbursed"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

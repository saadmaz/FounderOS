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
import { setInvestmentCurrentValue } from "@/lib/data/investments";
import { formatCurrency } from "@/lib/format";
import type { Investment } from "@/lib/types";

const schema = z.object({
  currentValue: z
    .string()
    .min(1, "Enter a value")
    .refine((v) => !isNaN(Number(v)) && Number(v) >= 0, "Must be ≥ 0"),
});

type FormValues = z.infer<typeof schema>;

/**
 * Quick-action counterpart to InvestmentFormDialog - marking an investment
 * to market is something you do far more often than editing what it is,
 * so this is the one-field dialog behind the table's "Update value" action
 * instead of making that a trip through the full edit form every time.
 */
export function InvestmentValueDialog({
  open,
  onOpenChange,
  workspaceId,
  investment,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  workspaceId: string;
  investment: Investment | null;
}) {
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { currentValue: "" },
  });

  useEffect(() => {
    if (!open || !investment) return;
    reset({
      currentValue:
        investment.currentValue !== undefined ? String(investment.currentValue) : String(investment.amount),
    });
  }, [open, investment, reset]);

  async function onSubmit(values: FormValues) {
    if (!investment) return;
    setSubmitting(true);
    try {
      await setInvestmentCurrentValue(workspaceId, investment.id, Number(values.currentValue));
      toast.success("Current value updated");
      onOpenChange(false);
    } catch {
      toast.error("Couldn't update the value. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Update current value</DialogTitle>
        </DialogHeader>
        {investment && (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="currentValue">Current value ({investment.currency})</Label>
              <Input
                id="currentValue"
                type="number"
                step="0.01"
                min="0"
                autoFocus
                {...register("currentValue")}
              />
              {errors.currentValue && (
                <p className="text-xs text-danger">{errors.currentValue.message}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Put in {formatCurrency(investment.amount, investment.currency)}
              </p>
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

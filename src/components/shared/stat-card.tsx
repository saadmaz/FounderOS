"use client";

import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  icon: Icon,
  accent = "text-primary",
  accentBg = "bg-primary/10",
  delta,
  loading,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  accent?: string;
  accentBg?: string;
  delta?: { value: string; positive: boolean };
  loading?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      // min-w-0 lets this shrink below its content's intrinsic width - a grid
      // item (and this card's own flex children) refuse to shrink below that
      // by default, so a long formatted value (e.g. a big LKR total) would
      // otherwise force the whole grid track wider than the viewport instead
      // of wrapping/truncating, pushing content off-screen on mobile.
      className="group/stat min-w-0 rounded-xl border border-border bg-card p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-border-hover hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        {/* Wraps instead of truncating - on a cramped 3-up mobile grid (the
            company header stats) an ellipsis reduced "Active Projects" to
            unreadable "Activ…"; two short lines stay legible at any width
            this card actually gets used at. */}
        <span className="min-w-0 text-xs leading-snug font-medium text-muted-foreground">{label}</span>
        <div
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ring-ring-subtle transition-transform duration-200 group-hover/stat:scale-105",
            accentBg
          )}
        >
          <Icon className={cn("size-3.5", accent)} />
        </div>
      </div>
      <div className="mt-2.5 flex min-w-0 items-baseline gap-2">
        {loading ? (
          <div className="h-7 w-16 animate-pulse rounded bg-muted" />
        ) : (
          <span
            className="truncate text-2xl font-semibold tracking-tight tabular-nums"
            title={value}
          >
            {value}
          </span>
        )}
        {delta && !loading && (
          <span
            className={cn(
              "flex shrink-0 items-center text-xs font-medium",
              delta.positive ? "text-success" : "text-danger"
            )}
          >
            {delta.positive ? (
              <ArrowUpRight className="size-3.5" />
            ) : (
              <ArrowDownRight className="size-3.5" />
            )}
            {delta.value}
          </span>
        )}
      </div>
    </motion.div>
  );
}

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
      className="rounded-xl border border-border bg-card p-4"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <div className={cn("flex size-7 items-center justify-center rounded-lg", accentBg)}>
          <Icon className={cn("size-3.5", accent)} />
        </div>
      </div>
      <div className="mt-2.5 flex items-baseline gap-2">
        {loading ? (
          <div className="h-7 w-16 animate-pulse rounded bg-muted" />
        ) : (
          <span className="text-2xl font-semibold tracking-tight">{value}</span>
        )}
        {delta && !loading && (
          <span
            className={cn(
              "flex items-center text-xs font-medium",
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

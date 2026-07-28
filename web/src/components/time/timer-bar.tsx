"use client";

import { Play, Square } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { startTimer, stopTimer } from "@/lib/data/time-entries";
import type { Company, TimeEntry } from "@/lib/types";
import { cn } from "@/lib/utils";

function elapsedLabel(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

export function TimerBar({
  workspaceId,
  memberId,
  companies,
  runningEntry,
}: {
  workspaceId: string;
  memberId: string;
  companies: Company[];
  runningEntry: TimeEntry | null;
}) {
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "");
  const [elapsed, setElapsed] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!runningEntry) return;
    const tick = () => setElapsed(Date.now() - runningEntry.startedAt);
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [runningEntry]);

  async function handleStart() {
    if (!companyId) {
      toast.error("Pick a company first");
      return;
    }
    setBusy(true);
    try {
      await startTimer(workspaceId, { memberId, companyId });
    } finally {
      setBusy(false);
    }
  }

  async function handleStop() {
    if (!runningEntry) return;
    setBusy(true);
    try {
      await stopTimer(workspaceId, runningEntry.id);
      toast.success("Timer stopped");
    } finally {
      setBusy(false);
    }
  }

  const activeCompany = companies.find((c) => c.id === (runningEntry?.companyId ?? companyId));

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-xl border p-4 transition-colors",
        runningEntry ? "border-primary/30 bg-primary/5" : "border-border bg-card"
      )}
    >
      <div
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-full",
          runningEntry ? "animate-pulse bg-primary/20" : "bg-secondary"
        )}
      >
        <span
          className="size-2.5 rounded-full"
          style={{ backgroundColor: activeCompany?.color ?? "#71717A" }}
        />
      </div>

      {runningEntry ? (
        <>
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">Tracking time on</p>
            <p className="text-sm font-medium">{activeCompany?.name ?? "—"}</p>
          </div>
          <span className="font-mono text-xl font-semibold tabular-nums">{elapsedLabel(elapsed)}</span>
          <Button onClick={handleStop} disabled={busy} variant="destructive" className="gap-1.5">
            <Square className="size-3.5 fill-current" />
            Stop
          </Button>
        </>
      ) : (
        <>
          <div className="flex-1">
            <Select value={companyId} onValueChange={(v) => setCompanyId(v ?? "")}>
              <SelectTrigger className="w-56">
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
          </div>
          <Button onClick={handleStart} disabled={busy} className="gap-1.5">
            <Play className="size-3.5 fill-current" />
            Start timer
          </Button>
        </>
      )}
    </div>
  );
}

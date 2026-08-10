"use client";

import { Square, Timer } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/auth-provider";
import { findRunningEntry, stopTimer, useTimeEntries } from "@/lib/data/time-entries";
import { useWorkspace } from "@/lib/workspace/workspace-provider";

function elapsedLabel(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

/** Lives in the topbar so a timer started anywhere - the Time page, a task,
 * a project - stays visible (and stoppable) no matter where you navigate. */
export function RunningTimerIndicator() {
  const { user } = useAuth();
  const { workspace } = useWorkspace();
  const { data: entries } = useTimeEntries(workspace?.id ?? null, user?.uid);
  const running = user ? findRunningEntry(entries, user.uid) : null;
  const [elapsed, setElapsed] = useState(0);
  const [stopping, setStopping] = useState(false);

  useEffect(() => {
    if (!running) return;
    const tick = () => setElapsed(Date.now() - running.startedAt);
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [running]);

  if (!running || !workspace) return null;

  async function handleStop() {
    setStopping(true);
    try {
      await stopTimer(workspace!.id, running!.id);
    } finally {
      setStopping(false);
    }
  }

  return (
    <Link
      href="/time"
      className="flex h-8 items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 pl-2.5 pr-1 text-xs transition-colors hover:bg-primary/10"
    >
      <Timer className="size-3.5 shrink-0 text-primary" />
      <span className="hidden max-w-32 truncate font-medium sm:inline">{running.subjectLabel ?? "Tracking"}</span>
      <span className="font-mono tabular-nums">{elapsedLabel(elapsed)}</span>
      <Button
        variant="ghost"
        size="icon"
        className="size-6 text-muted-foreground hover:text-danger"
        disabled={stopping}
        aria-label="Stop timer"
        onClick={(e) => {
          e.preventDefault();
          handleStop();
        }}
      >
        <Square className="size-3 fill-current" />
      </Button>
    </Link>
  );
}

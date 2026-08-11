"use client";

import { Clock, LogIn, LogOut, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { TimeOffDialog } from "@/components/companies/time-off-dialog";
import { useAuth } from "@/lib/auth/auth-provider";
import { findRunningEntry, stopTimer, switchTimer, useTimeEntries } from "@/lib/data/time-entries";
import { deleteTimeOff, startOfDay, useTimeOff } from "@/lib/data/time-off";
import { formatDate, formatHours, sumHours } from "@/lib/format";
import { TIME_OFF_REASONS, type Company } from "@/lib/types";
import { useWorkspace } from "@/lib/workspace/workspace-provider";
import { cn } from "@/lib/utils";

function elapsedLabel(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

/**
 * Clock in/out + "mark today off" for a "work" (day job) company - the
 * generic cross-company TimerBar (Time Tracking page) still works for this
 * company too since these write the same TimeEntry docs, but a day job
 * wants a one-tap clock rather than picking a project/task every time, plus
 * a way to account for days you're simply not working (see time-off.ts).
 */
export function CompanyClockWidget({ company }: { company: Company }) {
  const { workspace } = useWorkspace();
  const { user } = useAuth();
  const workspaceId = workspace?.id ?? null;

  const { data: memberEntries } = useTimeEntries(workspaceId, user?.uid);
  const { data: timeOff } = useTimeOff(workspaceId, company.id);

  const runningEntry = user ? findRunningEntry(memberEntries, user.uid) : null;
  const clockedInHere = runningEntry?.companyId === company.id;

  // elapsed is only ever read while clockedInHere is true (below), so a
  // stale value sitting in state the rest of the time is harmless - no need
  // to reset it on stop, which would just be a second setState per effect run.
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!clockedInHere || !runningEntry) return;
    const tick = () => setElapsed(Date.now() - runningEntry.startedAt);
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [clockedInHere, runningEntry]);

  // Snapshot "today" once at mount rather than reading Date.now() during
  // render (impure - React requires render to be a pure function of
  // props/state). A day boundary crossing while this stays mounted is an
  // acceptable edge case for a "what's today's status" widget.
  const [today] = useState(() => startOfDay(Date.now()));
  const todaysOff = timeOff.find((t) => t.date === today);
  const reasonLabel = (r: string) => TIME_OFF_REASONS.find((x) => x.value === r)?.label ?? r;

  const todaysHours = useMemo(
    () =>
      sumHours(
        memberEntries.filter((e) => e.companyId === company.id && startOfDay(e.startedAt) === today)
      ),
    [memberEntries, company.id, today]
  );

  const [busy, setBusy] = useState(false);
  const [offDialogOpen, setOffDialogOpen] = useState(false);

  async function handleClockIn() {
    if (!workspaceId || !user) return;
    setBusy(true);
    try {
      await switchTimer(
        workspaceId,
        { memberId: user.uid, companyId: company.id, subjectLabel: `Clocked in · ${company.name}` },
        runningEntry?.id
      );
      toast.success("Clocked in");
    } finally {
      setBusy(false);
    }
  }

  async function handleClockOut() {
    if (!workspaceId || !runningEntry) return;
    setBusy(true);
    try {
      await stopTimer(workspaceId, runningEntry.id);
      toast.success("Clocked out");
    } finally {
      setBusy(false);
    }
  }

  async function handleUndoOff() {
    if (!workspaceId || !todaysOff) return;
    await deleteTimeOff(workspaceId, todaysOff.id);
    toast.success("Removed");
  }

  const recentOff = timeOff.slice(0, 5);

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-full",
              clockedInHere ? "animate-pulse bg-primary/20" : todaysOff ? "bg-warning/10" : "bg-secondary"
            )}
          >
            <Clock
              className={cn(
                "size-4",
                clockedInHere ? "text-primary" : todaysOff ? "text-warning" : "text-muted-foreground"
              )}
            />
          </div>
          <div className="min-w-0">
            {todaysOff ? (
              <>
                <p className="truncate text-sm font-medium">Off today · {reasonLabel(todaysOff.reason)}</p>
                <p className="truncate text-xs text-muted-foreground">{todaysOff.note || "Not working"}</p>
              </>
            ) : clockedInHere ? (
              <>
                <p className="font-mono text-lg font-semibold tabular-nums">{elapsedLabel(elapsed)}</p>
                <p className="text-xs text-muted-foreground">Clocked in</p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium">Not clocked in</p>
                <p className="text-xs text-muted-foreground">
                  {todaysHours > 0 ? `${formatHours(todaysHours)} logged today` : "No time logged today"}
                </p>
              </>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {todaysOff ? (
            <Button variant="outline" size="sm" onClick={handleUndoOff}>
              Undo
            </Button>
          ) : clockedInHere ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleClockOut}
              disabled={busy}
              className="gap-1.5"
            >
              <LogOut className="size-3.5" />
              Clock out
            </Button>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => setOffDialogOpen(true)}>
                Mark off
              </Button>
              <Button size="sm" onClick={handleClockIn} disabled={busy} className="gap-1.5">
                <LogIn className="size-3.5" />
                Clock in
              </Button>
            </>
          )}
        </div>
      </div>

      {recentOff.length > 0 && (
        <div className="mt-4 border-t border-border pt-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Recent time off</p>
          <div className="flex flex-wrap gap-1.5">
            {recentOff.map((entry) => (
              <span
                key={entry.id}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-2.5 py-1 text-xs text-muted-foreground"
              >
                {formatDate(entry.date)} · {reasonLabel(entry.reason)}
                <button
                  type="button"
                  onClick={() => workspaceId && deleteTimeOff(workspaceId, entry.id)}
                  className="text-muted-foreground-2 hover:text-danger"
                  aria-label={`Remove ${formatDate(entry.date)} time off`}
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {workspaceId && user && (
        <TimeOffDialog
          open={offDialogOpen}
          onOpenChange={setOffDialogOpen}
          workspaceId={workspaceId}
          companyId={company.id}
          memberId={user.uid}
        />
      )}
    </div>
  );
}

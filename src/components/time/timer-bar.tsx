"use client";

import { Play, Square } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProjects } from "@/lib/data/projects";
import { useTasks } from "@/lib/data/tasks";
import { stopTimer, switchTimer } from "@/lib/data/time-entries";
import { timeEntrySubjectLabel } from "@/lib/labels";
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
  const [projectId, setProjectId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [note, setNote] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [busy, setBusy] = useState(false);

  const { data: projects } = useProjects(workspaceId, companyId || undefined);
  const { data: tasksInCompany } = useTasks(workspaceId, companyId || undefined);
  const tasks = useMemo(
    () => (projectId ? tasksInCompany.filter((t) => t.projectId === projectId) : tasksInCompany),
    [tasksInCompany, projectId]
  );

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
    const company = companies.find((c) => c.id === companyId);
    const project = projects.find((p) => p.id === projectId);
    const task = tasks.find((t) => t.id === taskId);
    setBusy(true);
    try {
      await switchTimer(
        workspaceId,
        {
          memberId,
          companyId,
          projectId: projectId || undefined,
          taskId: taskId || undefined,
          note: note.trim() || undefined,
          subjectLabel: timeEntrySubjectLabel({ company, project, task, note }),
        },
        runningEntry?.id
      );
      setNote("");
      setProjectId("");
      setTaskId("");
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
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {runningEntry.subjectLabel ?? activeCompany?.name ?? "—"}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {activeCompany?.name ?? "No company"}
            </p>
          </div>
          <span className="font-mono text-xl font-semibold tabular-nums">{elapsedLabel(elapsed)}</span>
          <Button onClick={handleStop} disabled={busy} variant="destructive" className="gap-1.5">
            <Square className="size-3.5 fill-current" />
            Stop
          </Button>
        </>
      ) : (
        <>
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <Select
              value={companyId}
              onValueChange={(v) => {
                setCompanyId(v ?? "");
                setProjectId("");
                setTaskId("");
              }}
            >
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Company">
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

            <Select
              value={projectId}
              onValueChange={(v) => {
                setProjectId(v ?? "");
                setTaskId("");
              }}
              disabled={!companyId}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Project (optional)">
                  {(v: string) => projects.find((p) => p.id === v)?.name ?? "No project"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={taskId} onValueChange={(v) => setTaskId(v ?? "")} disabled={!companyId}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Task (optional)">
                  {(v: string) => tasks.find((t) => t.id === v)?.title ?? "No task"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {tasks.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Or just say what you're doing…"
              className="w-48"
            />
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

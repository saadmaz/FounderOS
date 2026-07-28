"use client";

import { ArrowLeft, CheckSquare, Clock, Loader2, Plus, Target } from "lucide-react";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatCard } from "@/components/shared/stat-card";
import { PriorityBadge } from "@/components/shared/status-badge";
import { TaskFormDialog } from "@/components/tasks/task-form-dialog";
import { TaskTable } from "@/components/tasks/task-table";
import { useCompanies } from "@/lib/data/companies";
import { updateProject, useProjects } from "@/lib/data/projects";
import { useTasks } from "@/lib/data/tasks";
import { useTimeEntries } from "@/lib/data/time-entries";
import { formatHours, sumHours } from "@/lib/format";
import type { ProjectStatus } from "@/lib/types";
import { useWorkspace } from "@/lib/workspace/workspace-provider";

const STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: "not_started", label: "Not Started" },
  { value: "in_progress", label: "In Progress" },
  { value: "blocked", label: "Blocked" },
  { value: "in_review", label: "In Review" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "on_hold", label: "On Hold" },
];

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { workspace } = useWorkspace();
  const { data: companies, loading: companiesLoading } = useCompanies(workspace?.id ?? null);
  const { data: projects, loading: projectsLoading } = useProjects(workspace?.id ?? null);
  const { data: allTasks } = useTasks(workspace?.id ?? null);
  const { data: timeEntries } = useTimeEntries(workspace?.id ?? null);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);

  const project = projects.find((p) => p.id === projectId);
  const company = companies.find((c) => c.id === project?.companyId);
  const tasks = useMemo(() => allTasks.filter((t) => t.projectId === projectId), [allTasks, projectId]);

  const actualHours = useMemo(() => {
    const taskIds = new Set(tasks.map((t) => t.id));
    return sumHours(timeEntries.filter((e) => e.taskId && taskIds.has(e.taskId)));
  }, [timeEntries, tasks]);

  const completed = tasks.filter((t) => t.status === "completed").length;

  if (companiesLoading || projectsLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!project) return notFound();

  return (
    <>
      <div className="border-b border-border px-4 py-4 lg:px-6">
        <Link
          href="/projects"
          className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          All projects
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              {company && (
                <Link
                  href={`/companies/${company.id}`}
                  className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  <span className="size-1.5 rounded-full" style={{ backgroundColor: company.color }} />
                  {company.name}
                </Link>
              )}
            </div>
            <h1 className="mt-1 text-xl font-semibold tracking-tight">{project.name}</h1>
            {project.description && (
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">{project.description}</p>
            )}
            <div className="mt-2 flex items-center gap-2">
              <PriorityBadge priority={project.priority} />
            </div>
          </div>
          <Select
            value={project.status}
            onValueChange={(v) => v && updateProject(workspace!.id, project.id, { status: v as ProjectStatus })}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3 sm:max-w-md">
          <StatCard label="Tasks" value={`${completed}/${tasks.length}`} icon={CheckSquare} accent="text-warning" accentBg="bg-warning/10" />
          <StatCard label="Actual Hours" value={formatHours(actualHours)} icon={Clock} accent="text-analytics-pink" accentBg="bg-analytics-pink/10" />
          <StatCard
            label="Estimated"
            value={project.estimatedHours ? formatHours(project.estimatedHours) : "—"}
            icon={Target}
            accent="text-analytics-cyan"
            accentBg="bg-analytics-cyan/10"
          />
        </div>
      </div>

      <div className="flex-1 p-4 lg:p-6">
        <div className="mb-3 flex justify-end">
          <Button size="sm" onClick={() => setTaskDialogOpen(true)} className="gap-1.5">
            <Plus className="size-3.5" /> New task
          </Button>
        </div>
        <TaskTable tasks={tasks} companies={companies} workspaceId={workspace!.id} showCompany={false} />
      </div>

      <TaskFormDialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen} defaultCompanyId={project.companyId} />
    </>
  );
}

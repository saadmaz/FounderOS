"use client";

import { ArrowLeft, CheckSquare, Clock, Pencil, Plus, Target, Trash2 } from "lucide-react";
import Link from "next/link";
import { notFound, useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DetailPageSkeleton } from "@/components/shared/detail-page-skeleton";
import { StatCard } from "@/components/shared/stat-card";
import { PriorityBadge } from "@/components/shared/status-badge";
import { ProjectFormDialog } from "@/components/projects/project-form-dialog";
import { TaskFormDialog } from "@/components/tasks/task-form-dialog";
import { TaskTable } from "@/components/tasks/task-table";
import { useConfirm } from "@/lib/confirm/confirm-provider";
import { useCompanies } from "@/lib/data/companies";
import { useMembers } from "@/lib/data/members";
import { deleteProject, updateProject, useProjects } from "@/lib/data/projects";
import { useTasks } from "@/lib/data/tasks";
import { useTimeEntries } from "@/lib/data/time-entries";
import { formatDate, formatHours, sumHours } from "@/lib/format";
import { projectStatusLabel } from "@/lib/labels";
import { PROJECT_STATUSES, type ProjectStatus, type Task } from "@/lib/types";
import { useWorkspace } from "@/lib/workspace/workspace-provider";

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();
  const { workspace } = useWorkspace();
  const confirm = useConfirm();
  const { data: companies, loading: companiesLoading } = useCompanies(workspace?.id ?? null);
  const { data: members } = useMembers(workspace?.id ?? null);
  const { data: projects, loading: projectsLoading } = useProjects(workspace?.id ?? null);
  const { data: allTasks } = useTasks(workspace?.id ?? null);
  const { data: timeEntries } = useTimeEntries(workspace?.id ?? null);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editProjectOpen, setEditProjectOpen] = useState(false);

  const project = projects.find((p) => p.id === projectId);
  const company = companies.find((c) => c.id === project?.companyId);
  const owner = project?.ownerId ? members.find((m) => m.id === project.ownerId) : undefined;
  const tasks = useMemo(() => allTasks.filter((t) => t.projectId === projectId), [allTasks, projectId]);

  const actualHours = useMemo(() => {
    const taskIds = new Set(tasks.map((t) => t.id));
    // Time can be logged against this project two ways: against one of its
    // tasks (taskId), or directly against the project with no task picked
    // (projectId, timer/manual entry) - both count toward "Actual Hours".
    return sumHours(
      timeEntries.filter(
        (e) => e.projectId === projectId || (e.taskId && taskIds.has(e.taskId))
      )
    );
  }, [timeEntries, tasks, projectId]);

  const completed = tasks.filter((t) => t.status === "completed").length;

  if (companiesLoading || projectsLoading) {
    return <DetailPageSkeleton />;
  }
  if (!project) return notFound();

  async function handleDeleteProject() {
    if (!workspace || !project) return;
    if (!(await confirm(`Delete "${project.name}"? This can't be undone.`))) return;
    try {
      await deleteProject(workspace.id, project.id);
      toast.success(`${project.name} deleted`);
      router.push("/projects");
    } catch {
      toast.error("Couldn't delete the project. Try again.");
    }
  }

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
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <PriorityBadge priority={project.priority} />
              {(project.startDate || project.endDate) && (
                <span className="text-xs text-muted-foreground">
                  {project.startDate ? formatDate(project.startDate) : "—"}
                  {" – "}
                  {project.endDate ? formatDate(project.endDate) : "—"}
                </span>
              )}
              {owner && (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Avatar size="sm" className="size-5">
                    <AvatarImage src={owner.photoURL} />
                    <AvatarFallback className="text-[9px]">
                      {(owner.displayName ?? "")
                        .split(" ")
                        .map((s) => s[0])
                        .slice(0, 2)
                        .join("")
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {owner.displayName}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={project.status}
              onValueChange={(v) => v && updateProject(workspace!.id, project.id, { status: v as ProjectStatus })}
            >
              <SelectTrigger className="w-37.5">
                <SelectValue>{(v: ProjectStatus) => projectStatusLabel(v)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {PROJECT_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" aria-label="Edit project" onClick={() => setEditProjectOpen(true)}>
              <Pencil className="size-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label="Delete project"
              className="text-danger hover:text-danger"
              onClick={handleDeleteProject}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
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
        <TaskTable
          tasks={tasks}
          companies={companies}
          workspaceId={workspace!.id}
          showCompany={false}
          onEdit={setEditingTask}
        />
      </div>

      <TaskFormDialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen} defaultCompanyId={project.companyId} />
      <TaskFormDialog
        open={Boolean(editingTask)}
        onOpenChange={(v) => !v && setEditingTask(null)}
        task={editingTask}
      />
      <ProjectFormDialog open={editProjectOpen} onOpenChange={setEditProjectOpen} project={project} />
    </>
  );
}

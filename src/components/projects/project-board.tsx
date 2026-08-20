"use client";

import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useDraggable } from "@dnd-kit/core";
import { useMemo, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { PriorityBadge } from "@/components/shared/status-badge";
import { updateProject } from "@/lib/data/projects";
import type { Company, Project, ProjectStatus, Task, WorkspaceMember } from "@/lib/types";
import { cn } from "@/lib/utils";

const COLUMNS: { status: ProjectStatus; label: string; dot: string }[] = [
  { status: "not_started", label: "Not Started", dot: "bg-muted-foreground-2" },
  { status: "in_progress", label: "In Progress", dot: "bg-primary" },
  { status: "in_review", label: "In Review", dot: "bg-analytics-purple" },
  { status: "blocked", label: "Blocked", dot: "bg-danger" },
  { status: "completed", label: "Completed", dot: "bg-success" },
];

function initials(name?: string) {
  return (name ?? "")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function ProjectCard({
  project,
  company,
  owner,
  pct,
}: {
  project: Project;
  company?: Company;
  owner?: WorkspaceMember;
  pct: number;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: project.id,
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn(
        "cursor-grab space-y-2 rounded-lg border border-border bg-card p-3 active:cursor-grabbing",
        isDragging && "opacity-40"
      )}
    >
      <p className="text-sm font-medium leading-snug">{project.name}</p>
      <div className="flex items-center gap-1.5">
        {company && <span className="size-1.5 rounded-full" style={{ backgroundColor: company.color }} />}
        <span className="text-[11px] text-muted-foreground">{company?.name}</span>
      </div>
      <div className="flex items-center gap-2">
        <Progress value={pct} className="h-1.5" />
        <span className="w-8 shrink-0 text-right text-[11px] text-muted-foreground">{pct}%</span>
      </div>
      <div className="flex items-center justify-between">
        <PriorityBadge priority={project.priority} />
        {owner && (
          <Avatar size="sm" className="size-5" title={owner.displayName}>
            <AvatarImage src={owner.photoURL} />
            <AvatarFallback className="text-[9px]">{initials(owner.displayName)}</AvatarFallback>
          </Avatar>
        )}
      </div>
    </div>
  );
}

function Column({
  status,
  label,
  dot,
  projects,
  companyById,
  memberById,
  tasks,
}: {
  status: ProjectStatus;
  label: string;
  dot: string;
  projects: Project[];
  companyById: Map<string, Company>;
  memberById: Map<string, WorkspaceMember>;
  tasks: Task[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-72 shrink-0 flex-col rounded-xl border border-border bg-surface/50 transition-colors",
        isOver && "border-primary/40 bg-primary/5"
      )}
    >
      <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
        <span className={cn("size-2 rounded-full", dot)} />
        <span className="text-xs font-semibold">{label}</span>
        <span className="ml-auto text-xs text-muted-foreground-2">{projects.length}</span>
      </div>
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2 scrollbar-thin">
        {projects.map((p) => {
          const projectTasks = tasks.filter((t) => t.projectId === p.id);
          const completed = projectTasks.filter((t) => t.status === "completed").length;
          const pct = projectTasks.length ? Math.round((completed / projectTasks.length) * 100) : 0;
          return (
            <ProjectCard
              key={p.id}
              project={p}
              company={companyById.get(p.companyId)}
              owner={p.ownerId ? memberById.get(p.ownerId) : undefined}
              pct={pct}
            />
          );
        })}
      </div>
    </div>
  );
}

export function ProjectBoard({
  projects,
  companies,
  members,
  tasks,
  workspaceId,
}: {
  projects: Project[];
  companies: Company[];
  members: WorkspaceMember[];
  tasks: Task[];
  workspaceId: string;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const companyById = useMemo(() => new Map(companies.map((c) => [c.id, c])), [companies]);
  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function handleDragStart(e: DragStartEvent) {
    setActiveId(e.active.id as string);
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const project = projects.find((p) => p.id === active.id);
    const newStatus = over.id as ProjectStatus;
    if (project && project.status !== newStatus) {
      updateProject(workspaceId, project.id, { status: newStatus });
    }
  }

  const activeProject = projects.find((p) => p.id === activeId);
  const activeProjectTasks = activeProject ? tasks.filter((t) => t.projectId === activeProject.id) : [];
  const activeCompleted = activeProjectTasks.filter((t) => t.status === "completed").length;
  const activePct = activeProjectTasks.length
    ? Math.round((activeCompleted / activeProjectTasks.length) * 100)
    : 0;

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex flex-1 gap-4 overflow-x-auto p-4 lg:p-6 scrollbar-thin">
        {COLUMNS.map((col) => (
          <Column
            key={col.status}
            {...col}
            projects={projects.filter((p) => p.status === col.status)}
            companyById={companyById}
            memberById={memberById}
            tasks={tasks}
          />
        ))}
      </div>
      <DragOverlay>
        {activeProject ? (
          <ProjectCard
            project={activeProject}
            company={companyById.get(activeProject.companyId)}
            owner={activeProject.ownerId ? memberById.get(activeProject.ownerId) : undefined}
            pct={activePct}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

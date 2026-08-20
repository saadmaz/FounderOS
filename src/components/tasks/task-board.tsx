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
import { ListChecks, Pencil, Repeat } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { PriorityBadge } from "@/components/shared/status-badge";
import { setTaskStatus } from "@/lib/data/tasks";
import { formatDate } from "@/lib/format";
import { recurrenceSummary } from "@/lib/recurrence";
import type { Company, Task, TaskStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const COLUMNS: { status: TaskStatus; label: string; dot: string }[] = [
  { status: "not_started", label: "Not Started", dot: "bg-muted-foreground-2" },
  { status: "in_progress", label: "In Progress", dot: "bg-primary" },
  { status: "in_review", label: "In Review", dot: "bg-analytics-purple" },
  { status: "blocked", label: "Blocked", dot: "bg-danger" },
  { status: "completed", label: "Completed", dot: "bg-success" },
];

function TaskCard({
  task,
  company,
  onEdit,
}: {
  task: Task;
  company?: Company;
  onEdit?: (task: Task) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
  });
  const today = new Date().setHours(0, 0, 0, 0);
  const overdue = task.dueDate && task.dueDate < today && task.status !== "completed";

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn(
        "group relative cursor-grab space-y-2 rounded-lg border border-border bg-card p-3 active:cursor-grabbing",
        isDragging && "opacity-40"
      )}
    >
      {onEdit && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-1.5 top-1.5 size-6 opacity-0 transition-opacity group-hover:opacity-100"
          aria-label="Edit task"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onEdit(task);
          }}
        >
          <Pencil className="size-3" />
        </Button>
      )}
      <p className="pr-5 text-sm font-medium leading-snug">{task.title}</p>
      {(task.recurrence || task.subtasks?.length || task.tags?.length) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {task.recurrence && (
            <span
              className="inline-flex items-center text-muted-foreground-2"
              title={recurrenceSummary(task.recurrence.frequency, task.recurrence.interval)}
            >
              <Repeat className="size-3" />
            </span>
          )}
          {task.subtasks && task.subtasks.length > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground-2">
              <ListChecks className="size-3" />
              {task.subtasks.filter((s) => s.done).length}/{task.subtasks.length}
            </span>
          )}
          {task.tags?.slice(0, 2).map((tag) => (
            <span key={tag} className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {tag}
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {company && (
            <span
              className="size-1.5 rounded-full"
              style={{ backgroundColor: company.color }}
            />
          )}
          <span className="text-[11px] text-muted-foreground">{company?.name}</span>
        </div>
        <PriorityBadge priority={task.priority} />
      </div>
      {task.dueDate && (
        <p className={cn("text-[11px]", overdue ? "font-medium text-danger" : "text-muted-foreground-2")}>
          Due {formatDate(task.dueDate)}
        </p>
      )}
    </div>
  );
}

function Column({
  status,
  label,
  dot,
  tasks,
  companyById,
  onEditTask,
}: {
  status: TaskStatus;
  label: string;
  dot: string;
  tasks: Task[];
  companyById: Map<string, Company>;
  onEditTask?: (task: Task) => void;
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
        <span className="ml-auto text-xs text-muted-foreground-2">{tasks.length}</span>
      </div>
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2 scrollbar-thin">
        {tasks.map((t) => (
          <TaskCard key={t.id} task={t} company={companyById.get(t.companyId)} onEdit={onEditTask} />
        ))}
      </div>
    </div>
  );
}

export function TaskBoard({
  tasks,
  companies,
  workspaceId,
  onEditTask,
}: {
  tasks: Task[];
  companies: Company[];
  workspaceId: string;
  onEditTask?: (task: Task) => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const companyById = useMemo(() => new Map(companies.map((c) => [c.id, c])), [companies]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function handleDragStart(e: DragStartEvent) {
    setActiveId(e.active.id as string);
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const task = tasks.find((t) => t.id === active.id);
    const newStatus = over.id as TaskStatus;
    if (task && task.status !== newStatus) {
      setTaskStatus(workspaceId, task.id, newStatus);
    }
  }

  const activeTask = tasks.find((t) => t.id === activeId);

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex flex-1 gap-4 overflow-x-auto p-4 lg:p-6 scrollbar-thin">
        {COLUMNS.map((col) => (
          <Column
            key={col.status}
            {...col}
            tasks={tasks.filter((t) => t.status === col.status)}
            companyById={companyById}
            onEditTask={onEditTask}
          />
        ))}
      </div>
      <DragOverlay>
        {activeTask ? <TaskCard task={activeTask} company={companyById.get(activeTask.companyId)} /> : null}
      </DragOverlay>
    </DndContext>
  );
}

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
import { PriorityBadge } from "@/components/shared/status-badge";
import { setTaskStatus } from "@/lib/data/tasks";
import { formatDate } from "@/lib/format";
import type { Company, Task, TaskStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const COLUMNS: { status: TaskStatus; label: string; dot: string }[] = [
  { status: "not_started", label: "Not Started", dot: "bg-muted-foreground-2" },
  { status: "in_progress", label: "In Progress", dot: "bg-primary" },
  { status: "in_review", label: "In Review", dot: "bg-analytics-purple" },
  { status: "blocked", label: "Blocked", dot: "bg-danger" },
  { status: "completed", label: "Completed", dot: "bg-success" },
];

function TaskCard({ task, company }: { task: Task; company?: Company }) {
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
        "cursor-grab space-y-2 rounded-lg border border-border bg-card p-3 active:cursor-grabbing",
        isDragging && "opacity-40"
      )}
    >
      <p className="text-sm font-medium leading-snug">{task.title}</p>
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
}: {
  status: TaskStatus;
  label: string;
  dot: string;
  tasks: Task[];
  companyById: Map<string, Company>;
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
          <TaskCard key={t.id} task={t} company={companyById.get(t.companyId)} />
        ))}
      </div>
    </div>
  );
}

export function TaskBoard({
  tasks,
  companies,
  workspaceId,
}: {
  tasks: Task[];
  companies: Company[];
  workspaceId: string;
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
          />
        ))}
      </div>
      <DragOverlay>
        {activeTask ? <TaskCard task={activeTask} company={companyById.get(activeTask.companyId)} /> : null}
      </DragOverlay>
    </DndContext>
  );
}

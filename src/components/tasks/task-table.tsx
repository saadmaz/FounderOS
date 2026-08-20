"use client";

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowUpDown, CheckSquare, ListChecks, MoreHorizontal, Pencil, Repeat, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PriorityBadge } from "@/components/shared/status-badge";
import { useConfirm } from "@/lib/confirm/confirm-provider";
import {
  bulkDeleteTasks,
  bulkSetTaskStatus,
  deleteTask,
  deleteTaskSeries,
  setTaskStatus,
} from "@/lib/data/tasks";
import { formatDate } from "@/lib/format";
import { taskStatusLabel } from "@/lib/labels";
import { recurrenceSummary } from "@/lib/recurrence";
import { TASK_STATUSES, type Company, type Task, type TaskStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export function TaskTable({
  tasks,
  companies,
  workspaceId,
  showCompany = true,
  onEdit,
}: {
  tasks: Task[];
  companies: Company[];
  workspaceId: string;
  showCompany?: boolean;
  onEdit?: (task: Task) => void;
}) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "dueDate", desc: false }]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const confirm = useConfirm();
  const companyById = new Map(companies.map((c) => [c.id, c]));
  const today = new Date().setHours(0, 0, 0, 0);

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleDelete(task: Task) {
    if (!(await confirm(`Delete "${task.title}"? This can't be undone.`))) return;
    await deleteTask(workspaceId, task.id);
  }

  async function handleDeleteSeries(task: Task) {
    if (!task.recurrence) return;
    if (
      !(await confirm(
        `Delete all ${task.recurrence.count} tasks in "${task.title}"'s series? This can't be undone.`
      ))
    )
      return;
    await deleteTaskSeries(workspaceId, task.recurrence.groupId);
    toast.success("Series deleted");
  }

  async function handleBulkComplete() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    await bulkSetTaskStatus(workspaceId, ids, "completed");
    toast.success(`${ids.length} task${ids.length === 1 ? "" : "s"} marked completed`);
    setSelectedIds(new Set());
  }

  async function handleBulkDelete() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!(await confirm(`Delete ${ids.length} task${ids.length === 1 ? "" : "s"}? This can't be undone.`))) return;
    await bulkDeleteTasks(workspaceId, ids);
    toast.success(`${ids.length} task${ids.length === 1 ? "" : "s"} deleted`);
    setSelectedIds(new Set());
  }

  const columns: ColumnDef<Task>[] = [
    {
      id: "select",
      header: () => (
        <Checkbox
          checked={tasks.length > 0 && tasks.every((t) => selectedIds.has(t.id))}
          onCheckedChange={(v) => setSelectedIds(v ? new Set(tasks.map((t) => t.id)) : new Set())}
          aria-label="Select all tasks"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={selectedIds.has(row.original.id)}
          onCheckedChange={() => toggleSelected(row.original.id)}
          aria-label={`Select ${row.original.title}`}
        />
      ),
    },
    {
      accessorKey: "title",
      header: "Task",
      cell: ({ row }) => {
        const t = row.original;
        const company = companyById.get(t.companyId);
        const due = t.dueDate;
        const overdue = due && due < today && t.status !== "completed";
        const hasMeta = Boolean(t.recurrence) || Boolean(t.subtasks?.length) || Boolean(t.tags?.length);
        return (
          <div className="flex items-center gap-2.5">
            {showCompany && (
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: company?.color ?? "#71717A" }}
              />
            )}
            <div className="min-w-0">
              <span
                className={cn(
                  "block truncate text-sm",
                  t.status === "completed" && "text-muted-foreground line-through"
                )}
              >
                {t.title}
              </span>
              {hasMeta && (
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                  {t.recurrence && (
                    <span
                      className="inline-flex items-center text-muted-foreground-2"
                      title={recurrenceSummary(t.recurrence.frequency, t.recurrence.interval)}
                    >
                      <Repeat className="size-3" />
                    </span>
                  )}
                  {t.subtasks && t.subtasks.length > 0 && (
                    <span className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground-2">
                      <ListChecks className="size-3" />
                      {t.subtasks.filter((s) => s.done).length}/{t.subtasks.length}
                    </span>
                  )}
                  {t.tags?.slice(0, 2).map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                  {t.tags && t.tags.length > 2 && (
                    <span className="text-[10px] text-muted-foreground-2">+{t.tags.length - 2}</span>
                  )}
                </div>
              )}
              {/* Priority/due date get their own columns from sm/md up - this
               * mirrors them compactly so nothing's lost on a phone. */}
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground sm:hidden">
                {showCompany && company && <span>{company.name}</span>}
                <span className={cn(overdue && "font-medium text-danger")}>{formatDate(due)}</span>
              </span>
            </div>
          </div>
        );
      },
    },
    ...(showCompany
      ? [
          {
            accessorKey: "companyId",
            header: "Company",
            cell: ({ row }: { row: { original: Task } }) => (
              <span className="text-sm text-muted-foreground">
                {companyById.get(row.original.companyId)?.name ?? "—"}
              </span>
            ),
          } satisfies ColumnDef<Task>,
        ]
      : []),
    {
      accessorKey: "priority",
      header: "Priority",
      cell: ({ row }) => <PriorityBadge priority={row.original.priority} />,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const t = row.original;
        return (
          <Select
            value={t.status}
            onValueChange={(v) => v && setTaskStatus(workspaceId, t.id, v as TaskStatus)}
          >
            <SelectTrigger size="sm" className="h-7 w-35 border-none bg-transparent shadow-none">
              <SelectValue>{(v: TaskStatus) => taskStatusLabel(v)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {TASK_STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      },
    },
    {
      accessorKey: "dueDate",
      header: ({ column }) => (
        <button
          className="flex items-center gap-1"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Due <ArrowUpDown className="size-3" />
        </button>
      ),
      cell: ({ row }) => {
        const due = row.original.dueDate;
        const overdue = due && due < today && row.original.status !== "completed";
        return (
          <span className={cn("text-sm", overdue ? "font-medium text-danger" : "text-muted-foreground")}>
            {formatDate(due)}
          </span>
        );
      },
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const t = row.original;
        return (
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="size-7" aria-label="Task actions" />}>
                <MoreHorizontal className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onEdit && (
                  <DropdownMenuItem onClick={() => onEdit(t)}>
                    <Pencil className="size-4" />
                    Edit
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem variant="destructive" onClick={() => handleDelete(t)}>
                  <Trash2 className="size-4" />
                  {t.recurrence ? "Delete this task" : "Delete"}
                </DropdownMenuItem>
                {t.recurrence && (
                  <DropdownMenuItem variant="destructive" onClick={() => handleDeleteSeries(t)}>
                    <Trash2 className="size-4" />
                    Delete series
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];

  const table = useReactTable({
    data: tasks,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  // Task (and Status/actions) always show; everything else steps in as the
  // viewport grows, same responsive-column pattern used by the other
  // tables - a phone-width table otherwise clips to 2-3 columns and the
  // rest is only reachable by scrolling sideways.
  //
  // "title" needs its own cap for a different reason: an HTML table with
  // default (auto) layout sizes each column to its content's natural width
  // before anything can truncate, and `truncate` alone has nothing to clip
  // against without one. Status (a fixed-width Select) and the delete
  // button are also always visible, so without this the title column could
  // push them past the right edge entirely on a phone - not just
  // untruncated text, but Status/actions rendered off-screen with no
  // scrollbar cue that they're there.
  const RESPONSIVE_COLUMN_CLASS: Record<string, string> = {
    select: "w-8",
    title: "max-w-32 sm:max-w-40 lg:max-w-56",
    companyId: "hidden sm:table-cell",
    priority: "hidden sm:table-cell",
    dueDate: "hidden md:table-cell",
  };

  return (
    <div>
      {selectedIds.size > 0 && (
        <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium">{selectedIds.size} selected</span>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={handleBulkComplete}>
            <CheckSquare className="size-3.5" />
            Mark completed
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-danger hover:text-danger"
            onClick={handleBulkDelete}
          >
            <Trash2 className="size-3.5" />
            Delete
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
            Cancel
          </Button>
        </div>
      )}
      <div className="overflow-hidden rounded-xl border border-border">
        <div className="scrollbar-thin overflow-x-auto">
          <Table>
            <TableHeader className="bg-surface">
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id} className="hover:bg-transparent">
                  {hg.headers.map((h) => (
                    <TableHead
                      key={h.id}
                      className={cn(
                        "text-xs font-medium text-muted-foreground",
                        RESPONSIVE_COLUMN_CLASS[h.column.id]
                      )}
                    >
                      {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} className="hover:bg-secondary/40">
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn("py-2", RESPONSIVE_COLUMN_CLASS[cell.column.id])}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
              {tasks.length === 0 && (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center text-sm text-muted-foreground">
                    No tasks yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

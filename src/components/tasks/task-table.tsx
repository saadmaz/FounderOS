"use client";

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowUpDown, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
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
import { deleteTask, setTaskStatus } from "@/lib/data/tasks";
import { formatDate } from "@/lib/format";
import { taskStatusLabel } from "@/lib/labels";
import { TASK_STATUSES, type Company, type Task, type TaskStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export function TaskTable({
  tasks,
  companies,
  workspaceId,
  showCompany = true,
}: {
  tasks: Task[];
  companies: Company[];
  workspaceId: string;
  showCompany?: boolean;
}) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "dueDate", desc: false }]);
  const companyById = new Map(companies.map((c) => [c.id, c]));
  const today = new Date().setHours(0, 0, 0, 0);

  const columns: ColumnDef<Task>[] = [
    {
      accessorKey: "title",
      header: "Task",
      cell: ({ row }) => {
        const t = row.original;
        const company = companyById.get(t.companyId);
        const due = t.dueDate;
        const overdue = due && due < today && t.status !== "completed";
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
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="icon"
          className="size-7 text-muted-foreground-2 hover:text-danger"
          onClick={() => deleteTask(workspaceId, row.original.id)}
          aria-label="Delete task"
        >
          <Trash2 className="size-3.5" />
        </Button>
      ),
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
  const RESPONSIVE_COLUMN_CLASS: Record<string, string> = {
    companyId: "hidden sm:table-cell",
    priority: "hidden sm:table-cell",
    dueDate: "hidden md:table-cell",
  };

  return (
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
  );
}

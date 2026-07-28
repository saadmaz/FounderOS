"use client";

import { CheckSquare, LayoutGrid, Plus, Table2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { TaskBoard } from "@/components/tasks/task-board";
import { TaskFormDialog } from "@/components/tasks/task-form-dialog";
import { TaskTable } from "@/components/tasks/task-table";
import { useCompanies } from "@/lib/data/companies";
import { useTasks } from "@/lib/data/tasks";
import { useWorkspace } from "@/lib/workspace/workspace-provider";
import { cn } from "@/lib/utils";

export default function TasksPage() {
  const { workspace } = useWorkspace();
  const { data: companies } = useCompanies(workspace?.id ?? null);
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const { data: tasks, loading } = useTasks(
    workspace?.id ?? null,
    companyFilter === "all" ? undefined : companyFilter
  );
  const [view, setView] = useState<"table" | "board">("board");
  const [createOpen, setCreateOpen] = useState(false);

  const openCount = useMemo(
    () => tasks.filter((t) => t.status !== "completed" && t.status !== "cancelled").length,
    [tasks]
  );

  return (
    <>
      <PageHeader
        title="Tasks"
        description={`${openCount} open task${openCount === 1 ? "" : "s"}`}
        actions={
          <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
            <Plus className="size-4" />
            New task
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5 lg:px-6">
        <Select value={companyFilter} onValueChange={(v) => setCompanyFilter(v ?? "all")}>
          <SelectTrigger size="sm" className="w-44">
            <SelectValue placeholder="All companies" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All companies</SelectItem>
            {companies.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="ml-auto flex items-center gap-1 rounded-lg border border-border bg-surface p-0.5">
          <button
            onClick={() => setView("board")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              view === "board" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
            )}
          >
            <LayoutGrid className="size-3.5" />
            Board
          </button>
          <button
            onClick={() => setView("table")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              view === "table" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
            )}
          >
            <Table2 className="size-3.5" />
            Table
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 p-6">
          <div className="h-full animate-pulse rounded-xl bg-muted" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="flex flex-1 p-6">
          <EmptyState
            icon={CheckSquare}
            title="No tasks yet"
            description="Create your first task to start tracking work across your companies."
            action={
              <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
                <Plus className="size-4" />
                New task
              </Button>
            }
          />
        </div>
      ) : view === "board" ? (
        <TaskBoard tasks={tasks} companies={companies} workspaceId={workspace!.id} />
      ) : (
        <div className="flex-1 p-4 lg:p-6">
          <TaskTable tasks={tasks} companies={companies} workspaceId={workspace!.id} />
        </div>
      )}

      <TaskFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultCompanyId={companyFilter === "all" ? undefined : companyFilter}
      />
    </>
  );
}

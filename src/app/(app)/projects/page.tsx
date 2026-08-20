"use client";

import { FolderKanban, LayoutGrid, Plus, Table2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";
import { TableSkeleton } from "@/components/shared/table-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { ProjectBoard } from "@/components/projects/project-board";
import { ProjectFormDialog } from "@/components/projects/project-form-dialog";
import { ProjectList } from "@/components/projects/project-list";
import { useCompanies } from "@/lib/data/companies";
import { useMembers } from "@/lib/data/members";
import { useProjects } from "@/lib/data/projects";
import { scrollMainToTop } from "@/lib/scroll";
import { useTasks } from "@/lib/data/tasks";
import type { Project } from "@/lib/types";
import { useWorkspace } from "@/lib/workspace/workspace-provider";
import { cn } from "@/lib/utils";

export default function ProjectsPage() {
  const { workspace } = useWorkspace();
  const { data: companies } = useCompanies(workspace?.id ?? null);
  const { data: members } = useMembers(workspace?.id ?? null);
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const { data: projects, loading } = useProjects(
    workspace?.id ?? null,
    companyFilter === "all" ? undefined : companyFilter
  );
  const { data: tasks } = useTasks(workspace?.id ?? null);
  const [view, setView] = useState<"list" | "board">("list");
  const [createOpen, setCreateOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  return (
    <>
      <PageHeader
        title="Projects"
        description={`${projects.length} project${projects.length === 1 ? "" : "s"}`}
        actions={
          <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
            <Plus className="size-4" />
            New project
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5 lg:px-6">
        <Select value={companyFilter} onValueChange={(v) => setCompanyFilter(v ?? "all")}>
          <SelectTrigger size="sm" className="w-44">
            <SelectValue>
              {(v: string) => (v === "all" ? "All companies" : companies.find((c) => c.id === v)?.name ?? v)}
            </SelectValue>
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
            onClick={() => {
              setView("list");
              scrollMainToTop();
            }}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              view === "list" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
            )}
          >
            <Table2 className="size-3.5" />
            List
          </button>
          <button
            onClick={() => {
              setView("board");
              scrollMainToTop();
            }}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              view === "board" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
            )}
          >
            <LayoutGrid className="size-3.5" />
            Board
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 p-4 lg:p-6">
          <TableSkeleton />
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-1 p-4 lg:p-6">
          <EmptyState
            icon={FolderKanban}
            title="No projects yet"
            description="Projects group related tasks together and roll up progress and hours automatically."
            action={
              <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
                <Plus className="size-4" />
                New project
              </Button>
            }
          />
        </div>
      ) : view === "board" ? (
        <ProjectBoard
          projects={projects}
          companies={companies}
          members={members}
          tasks={tasks}
          workspaceId={workspace!.id}
        />
      ) : (
        <div className="flex-1 p-4 lg:p-6">
          <ProjectList
            projects={projects}
            companies={companies}
            tasks={tasks}
            workspaceId={workspace!.id}
            onEdit={setEditingProject}
          />
        </div>
      )}

      <ProjectFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultCompanyId={companyFilter === "all" ? undefined : companyFilter}
      />
      <ProjectFormDialog
        open={Boolean(editingProject)}
        onOpenChange={(v) => !v && setEditingProject(null)}
        project={editingProject}
      />
    </>
  );
}

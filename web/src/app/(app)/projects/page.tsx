"use client";

import { FolderKanban, Plus } from "lucide-react";
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
import { PageHeader } from "@/components/shared/page-header";
import { ProjectFormDialog } from "@/components/projects/project-form-dialog";
import { ProjectList } from "@/components/projects/project-list";
import { useCompanies } from "@/lib/data/companies";
import { useProjects } from "@/lib/data/projects";
import { useTasks } from "@/lib/data/tasks";
import { useWorkspace } from "@/lib/workspace/workspace-provider";

export default function ProjectsPage() {
  const { workspace } = useWorkspace();
  const { data: companies } = useCompanies(workspace?.id ?? null);
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const { data: projects, loading } = useProjects(
    workspace?.id ?? null,
    companyFilter === "all" ? undefined : companyFilter
  );
  const { data: tasks } = useTasks(workspace?.id ?? null);
  const [createOpen, setCreateOpen] = useState(false);

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

      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5 lg:px-6">
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
      </div>

      <div className="flex-1 p-4 lg:p-6">
        {loading ? (
          <div className="h-64 animate-pulse rounded-xl bg-muted" />
        ) : projects.length === 0 ? (
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
        ) : (
          <ProjectList projects={projects} companies={companies} tasks={tasks} workspaceId={workspace!.id} />
        )}
      </div>

      <ProjectFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultCompanyId={companyFilter === "all" ? undefined : companyFilter}
      />
    </>
  );
}

"use client";

import Link from "next/link";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PriorityBadge } from "@/components/shared/status-badge";
import { updateProject } from "@/lib/data/projects";
import { projectStatusLabel } from "@/lib/labels";
import { PROJECT_STATUSES, type Company, type Project, type ProjectStatus, type Task } from "@/lib/types";
import { Progress } from "@/components/ui/progress";

export function ProjectList({
  projects,
  companies,
  tasks,
  workspaceId,
  showCompany = true,
}: {
  projects: Project[];
  companies: Company[];
  tasks: Task[];
  workspaceId: string;
  showCompany?: boolean;
}) {
  const companyById = new Map(companies.map((c) => [c.id, c]));

  return (
    <div className="divide-y divide-border rounded-xl border border-border bg-card">
      {projects.map((p) => {
        const projectTasks = tasks.filter((t) => t.projectId === p.id);
        const completed = projectTasks.filter((t) => t.status === "completed").length;
        const pct = projectTasks.length ? Math.round((completed / projectTasks.length) * 100) : 0;
        const company = companyById.get(p.companyId);

        return (
          <Link
            key={p.id}
            href={`/projects/${p.id}`}
            className="flex flex-col gap-3 px-4 py-3.5 transition-colors hover:bg-secondary/40 sm:flex-row sm:items-center"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {showCompany && company && (
                  <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: company.color }} />
                )}
                <p className="truncate text-sm font-medium">{p.name}</p>
              </div>
              {showCompany && company && (
                <p className="mt-0.5 text-xs text-muted-foreground">{company.name}</p>
              )}
            </div>

            <div className="flex items-center gap-4">
              <PriorityBadge priority={p.priority} />
              <div className="flex w-32 items-center gap-2">
                <Progress value={pct} className="h-1.5" />
                <span className="w-8 shrink-0 text-right text-xs text-muted-foreground">{pct}%</span>
              </div>
              <div onClick={(e) => e.preventDefault()}>
                <Select
                  value={p.status}
                  onValueChange={(v) => v && updateProject(workspaceId, p.id, { status: v as ProjectStatus })}
                >
                  <SelectTrigger size="sm" className="h-7 w-[130px]">
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
              </div>
            </div>
          </Link>
        );
      })}
      {projects.length === 0 && (
        <p className="px-4 py-10 text-center text-sm text-muted-foreground">No projects yet.</p>
      )}
    </div>
  );
}

"use client";

import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PriorityBadge } from "@/components/shared/status-badge";
import { useConfirm } from "@/lib/confirm/confirm-provider";
import { useMembers } from "@/lib/data/members";
import { deleteProject, updateProject } from "@/lib/data/projects";
import { projectStatusLabel } from "@/lib/labels";
import { PROJECT_STATUSES, type Company, type Project, type ProjectStatus, type Task } from "@/lib/types";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

function initials(name?: string) {
  return (name ?? "")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function ProjectList({
  projects,
  companies,
  tasks,
  workspaceId,
  showCompany = true,
  onEdit,
}: {
  projects: Project[];
  companies: Company[];
  tasks: Task[];
  workspaceId: string;
  showCompany?: boolean;
  onEdit?: (project: Project) => void;
}) {
  const confirm = useConfirm();
  const { data: members } = useMembers(workspaceId);
  const memberById = new Map(members.map((m) => [m.id, m]));
  const companyById = new Map(companies.map((c) => [c.id, c]));

  async function handleDelete(project: Project) {
    if (!(await confirm(`Delete "${project.name}"? This can't be undone.`))) return;
    try {
      await deleteProject(workspaceId, project.id);
      toast.success(`${project.name} deleted`);
    } catch {
      toast.error("Couldn't delete the project. Try again.");
    }
  }

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

            <div className="flex flex-wrap items-center gap-3 sm:gap-4">
              <PriorityBadge priority={p.priority} />
              {p.ownerId && memberById.get(p.ownerId) && (
                <Avatar size="sm" className="size-6" title={memberById.get(p.ownerId)?.displayName}>
                  <AvatarImage src={memberById.get(p.ownerId)?.photoURL} />
                  <AvatarFallback className="text-[10px]">
                    {initials(memberById.get(p.ownerId)?.displayName)}
                  </AvatarFallback>
                </Avatar>
              )}
              <div className="flex w-24 items-center gap-2 sm:w-32">
                <Progress value={pct} className="h-1.5" />
                <span className="w-8 shrink-0 text-right text-xs text-muted-foreground">{pct}%</span>
              </div>
              <div onClick={(e) => e.preventDefault()}>
                <Select
                  value={p.status}
                  onValueChange={(v) => v && updateProject(workspaceId, p.id, { status: v as ProjectStatus })}
                >
                  <SelectTrigger size="sm" className="h-7 w-32.5">
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
              <div onClick={(e) => e.preventDefault()}>
                <DropdownMenu>
                  <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="size-7" aria-label="Project actions" />}>
                    <MoreHorizontal className="size-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEdit?.(p)}>
                      <Pencil className="size-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem variant="destructive" onClick={() => handleDelete(p)}>
                      <Trash2 className="size-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
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

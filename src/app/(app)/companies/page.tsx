"use client";

import { motion } from "framer-motion";
import { Archive, ArchiveRestore, Building2, Clock, ListTodo, MoreHorizontal, Pencil, Plus } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { CompanyFormDialog } from "@/components/companies/company-form-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { archiveCompany, restoreCompany, useCompanies } from "@/lib/data/companies";
import { useMeetings } from "@/lib/data/meetings";
import { useTasks } from "@/lib/data/tasks";
import { useTimeEntries } from "@/lib/data/time-entries";
import { formatHours, sumHours, sumMeetingHours } from "@/lib/format";
import { companyTypeLabel } from "@/lib/labels";
import type { Company } from "@/lib/types";
import { useWorkspace } from "@/lib/workspace/workspace-provider";
import { toast } from "sonner";

export default function CompaniesPage() {
  const { workspace } = useWorkspace();
  const { data: companies, loading } = useCompanies(workspace?.id ?? null);
  const { data: tasks } = useTasks(workspace?.id ?? null);
  const { data: timeEntries } = useTimeEntries(workspace?.id ?? null);
  const { data: meetings } = useMeetings(workspace?.id ?? null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);

  const active = useMemo(() => companies.filter((c) => c.status !== "archived"), [companies]);
  const archived = useMemo(() => companies.filter((c) => c.status === "archived"), [companies]);

  function statsFor(companyId: string) {
    const open = tasks.filter(
      (t) => t.companyId === companyId && t.status !== "completed" && t.status !== "cancelled"
    ).length;
    const hours =
      sumHours(timeEntries.filter((e) => e.companyId === companyId)) +
      sumMeetingHours(meetings.filter((m) => m.companyId === companyId));
    return { open, hours };
  }

  async function handleArchive(id: string, name: string) {
    await archiveCompany(workspace!.id, id);
    toast.success(`${name} archived`);
  }
  async function handleRestore(id: string, name: string) {
    await restoreCompany(workspace!.id, id);
    toast.success(`${name} restored`);
  }

  return (
    <>
      <PageHeader
        title="Companies"
        description={`${active.length} active ${active.length === 1 ? "company" : "companies"}`}
        actions={
          <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
            <Plus className="size-4" />
            New company
          </Button>
        }
      />

      <div className="flex-1 p-4 lg:p-6">
        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-44 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : active.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No companies yet"
            description="Add your first company to start tracking projects, tasks, and time against it."
            action={
              <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
                <Plus className="size-4" />
                New company
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {active.map((c, i) => {
              const { open, hours } = statsFor(c.id);
              return (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: i * 0.03 }}
                  className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-border-hover hover:shadow-md"
                >
                  <div className="absolute right-3 top-3 z-10 opacity-0 transition-opacity group-hover:opacity-100">
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="size-7" aria-label="Company actions" />}>
                        <MoreHorizontal className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditing(c)}>
                          <Pencil className="size-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleArchive(c.id, c.name)}>
                          <Archive className="size-4" />
                          Archive
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <Link href={`/companies/${c.id}`} className="flex flex-1 flex-col">
                    <div className="flex items-center gap-3">
                      {/* A softly-tinted badge (the brand color at low
                          opacity, full-strength for the initial/icon on top)
                          reads as a refined, considered surface - a flat
                          solid-color block doesn't. */}
                      <Avatar size="lg" className="size-10 shrink-0 rounded-lg">
                        <AvatarImage src={c.logoUrl} className="rounded-lg" />
                        <AvatarFallback
                          className="rounded-lg text-sm font-semibold"
                          style={{ backgroundColor: `${c.color}1A`, color: c.color }}
                        >
                          {c.name[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold tracking-tight">{c.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{c.industry || "No industry set"}</p>
                      </div>
                    </div>

                    {c.description && (
                      <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                        {c.description}
                      </p>
                    )}

                    <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
                      <StatusBadge status={c.status} />
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                        {companyTypeLabel(c.type)}
                      </span>
                    </div>

                    <div className="mt-4 flex flex-1 items-end gap-4 border-t border-border pt-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <ListTodo className="size-3.5 text-muted-foreground-2" />
                        <span className="font-semibold tabular-nums text-foreground">{open}</span> open
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="size-3.5 text-muted-foreground-2" />
                        <span className="font-semibold tabular-nums text-foreground">{formatHours(hours)}</span> logged
                      </span>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        )}

        {archived.length > 0 && (
          <div className="mt-8">
            <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground-2">
              Archived
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {archived.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-xl border border-border bg-card/50 p-4 opacity-70 transition-opacity hover:opacity-100"
                >
                  <div className="flex items-center gap-3">
                    <Avatar size="lg" className="size-8 shrink-0 rounded-lg">
                      <AvatarImage src={c.logoUrl} className="rounded-lg" />
                      <AvatarFallback
                        className="rounded-lg text-xs font-semibold"
                        style={{ backgroundColor: `${c.color}1A`, color: c.color }}
                      >
                        {c.name[0]}
                      </AvatarFallback>
                    </Avatar>
                    <p className="truncate text-sm font-medium">{c.name}</p>
                  </div>
                  <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => handleRestore(c.id, c.name)}>
                    <ArchiveRestore className="size-3.5" />
                    Restore
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <CompanyFormDialog open={createOpen} onOpenChange={setCreateOpen} />
      <CompanyFormDialog
        open={Boolean(editing)}
        onOpenChange={(v) => !v && setEditing(null)}
        company={editing}
      />
    </>
  );
}

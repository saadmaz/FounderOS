"use client";

import { motion } from "framer-motion";
import { Archive, ArchiveRestore, Building2, MoreHorizontal, Pencil, Plus } from "lucide-react";
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
              <div key={i} className="h-48 animate-pulse rounded-lg bg-muted" />
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
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.15, delay: i * 0.02 }}
                  className="group relative flex flex-col overflow-hidden rounded-lg border border-border bg-card transition-colors duration-150 hover:border-border-hover hover:bg-surface/60"
                >
                  {/* A solid brand-color rail down the left edge - reads as a
                      category/identity marker the way infra and monitoring
                      dashboards flag entities with a colored rail, rather
                      than a soft decorative glow. */}
                  <div aria-hidden className="absolute inset-y-0 left-0 w-[3px]" style={{ backgroundColor: c.color }} />
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
                    <div className="flex items-center gap-3 border-b border-border py-3.5 pr-10 pl-5">
                      <Avatar size="lg" className="size-9 shrink-0 rounded-md ring-1 ring-inset ring-ring-subtle">
                        <AvatarImage src={c.logoUrl} className="rounded-md" />
                        <AvatarFallback
                          className="rounded-md font-mono text-xs font-semibold uppercase text-white"
                          style={{ backgroundColor: c.color }}
                        >
                          {c.name[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold leading-tight">{c.name}</p>
                        <p className="truncate font-mono text-[10px] font-medium uppercase tracking-wider text-muted-foreground-2">
                          {c.industry || "Unclassified"}
                        </p>
                      </div>
                    </div>

                    <div className="flex-1 px-5 py-3.5">
                      {c.description && (
                        <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                          {c.description}
                        </p>
                      )}
                      <div className="mt-3 flex flex-wrap items-center gap-1.5">
                        <StatusBadge status={c.status} />
                        <span className="rounded-sm border border-border px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wide text-muted-foreground-2">
                          {companyTypeLabel(c.type)}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 divide-x divide-border border-t border-border">
                      <div className="px-5 py-3">
                        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground-2">
                          Open
                        </p>
                        <p className="mt-0.5 font-mono text-lg leading-none font-semibold tabular-nums">
                          {open}
                        </p>
                      </div>
                      <div className="px-5 py-3">
                        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground-2">
                          Logged
                        </p>
                        <p className="mt-0.5 font-mono text-lg leading-none font-semibold tabular-nums">
                          {formatHours(hours)}
                        </p>
                      </div>
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
                  className="flex items-center justify-between rounded-lg border border-border bg-card/50 p-4 opacity-70 transition-opacity hover:opacity-100"
                >
                  <div className="flex items-center gap-3">
                    <Avatar size="lg" className="size-8 shrink-0 rounded-md">
                      <AvatarImage src={c.logoUrl} className="rounded-md" />
                      <AvatarFallback
                        className="rounded-md font-mono text-xs font-semibold uppercase text-white"
                        style={{ backgroundColor: c.color }}
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

"use client";

import { motion } from "framer-motion";
import { Archive, ArchiveRestore, Building2, MoreHorizontal, Plus } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { CompanyFormDialog } from "@/components/companies/company-form-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { archiveCompany, restoreCompany, useCompanies } from "@/lib/data/companies";
import { useTasks } from "@/lib/data/tasks";
import { useTimeEntries } from "@/lib/data/time-entries";
import { formatHours, sumHours } from "@/lib/format";
import { useWorkspace } from "@/lib/workspace/workspace-provider";
import { toast } from "sonner";

export default function CompaniesPage() {
  const { workspace } = useWorkspace();
  const { data: companies, loading } = useCompanies(workspace?.id ?? null);
  const { data: tasks } = useTasks(workspace?.id ?? null);
  const { data: timeEntries } = useTimeEntries(workspace?.id ?? null);
  const [createOpen, setCreateOpen] = useState(false);

  const active = useMemo(() => companies.filter((c) => c.status !== "archived"), [companies]);
  const archived = useMemo(() => companies.filter((c) => c.status === "archived"), [companies]);

  function statsFor(companyId: string) {
    const open = tasks.filter(
      (t) => t.companyId === companyId && t.status !== "completed" && t.status !== "cancelled"
    ).length;
    const hours = sumHours(timeEntries.filter((e) => e.companyId === companyId));
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
        description={`${active.length} active company${active.length === 1 ? "" : "ies"}`}
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
              <div key={i} className="h-40 animate-pulse rounded-xl bg-muted" />
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
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: i * 0.03 }}
                  className="group relative rounded-xl border border-border bg-card p-5 transition-colors hover:border-white/15"
                >
                  <div className="absolute right-3 top-3 opacity-0 transition-opacity group-hover:opacity-100">
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="size-7" />}>
                        <MoreHorizontal className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => handleArchive(c.id, c.name)}>
                          <Archive className="size-4" />
                          Archive
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <Link href={`/companies/${c.id}`} className="flex flex-col">
                    <div className="flex items-center gap-3">
                      <span
                        className="flex size-10 shrink-0 items-center justify-center rounded-lg text-sm font-semibold text-white"
                        style={{ backgroundColor: c.color }}
                      >
                        {c.name[0]}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{c.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {c.industry ?? "—"}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center gap-2">
                      <StatusBadge status={c.status} />
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-xs capitalize text-muted-foreground">
                        {c.type}
                      </span>
                    </div>
                    <div className="mt-4 flex items-center gap-4 border-t border-border pt-3 text-xs text-muted-foreground">
                      <span>
                        <strong className="font-semibold text-foreground">{open}</strong> open
                      </span>
                      <span>
                        <strong className="font-semibold text-foreground">{formatHours(hours)}</strong>{" "}
                        logged
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
                  className="flex items-center justify-between rounded-xl border border-border bg-card/50 p-4 opacity-70"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold text-white"
                      style={{ backgroundColor: c.color }}
                    >
                      {c.name[0]}
                    </span>
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
    </>
  );
}

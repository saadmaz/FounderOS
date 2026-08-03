"use client";

import { Clock, DollarSign, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { ManualEntryDialog } from "@/components/time/manual-entry-dialog";
import { TimerBar } from "@/components/time/timer-bar";
import { useAuth } from "@/lib/auth/auth-provider";
import { useCompanies } from "@/lib/data/companies";
import { deleteTimeEntry, findRunningEntry, useTimeEntries } from "@/lib/data/time-entries";
import { formatDateTime, formatHours } from "@/lib/format";
import { useWorkspace } from "@/lib/workspace/workspace-provider";

export default function TimeTrackingPage() {
  const { user } = useAuth();
  const { workspace } = useWorkspace();
  const { data: companies } = useCompanies(workspace?.id ?? null);
  const { data: entries, loading } = useTimeEntries(workspace?.id ?? null);
  const [manualOpen, setManualOpen] = useState(false);

  const companyById = new Map(companies.map((c) => [c.id, c]));
  const runningEntry = user ? findRunningEntry(entries, user.uid) : null;
  const completedEntries = useMemo(
    () => entries.filter((e) => e.endedAt !== null).sort((a, b) => b.startedAt - a.startedAt),
    [entries]
  );

  const totalHours = useMemo(
    () => completedEntries.reduce((sum, e) => sum + (e.endedAt! - e.startedAt) / 3_600_000, 0),
    [completedEntries]
  );
  const billableHours = useMemo(
    () =>
      completedEntries
        .filter((e) => e.billable)
        .reduce((sum, e) => sum + (e.endedAt! - e.startedAt) / 3_600_000, 0),
    [completedEntries]
  );

  return (
    <>
      <PageHeader
        title="Time Tracking"
        description="Every session, across every company."
        actions={
          <Button variant="outline" onClick={() => setManualOpen(true)} className="gap-1.5">
            <Plus className="size-4" />
            Log time
          </Button>
        }
      />

      <div className="flex-1 space-y-6 p-4 lg:p-6">
        {workspace && user && (
          <TimerBar
            workspaceId={workspace.id}
            memberId={user.uid}
            companies={companies}
            runningEntry={runningEntry}
          />
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
          <StatCard label="Total Hours Logged" value={formatHours(totalHours)} icon={Clock} />
          <StatCard
            label="Billable Hours"
            value={formatHours(billableHours)}
            icon={DollarSign}
            accent="text-success"
            accentBg="bg-success/10"
          />
        </div>

        {loading ? (
          <div className="h-64 animate-pulse rounded-xl bg-muted" />
        ) : completedEntries.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="No time logged yet"
            description="Start the timer above, or log a session manually."
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            <Table>
              <TableHeader className="bg-surface">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs font-medium text-muted-foreground">Company</TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground">Started</TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground">Duration</TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground">Billable</TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground">Note</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {completedEntries.map((e) => {
                  const company = companyById.get(e.companyId);
                  const hours = (e.endedAt! - e.startedAt) / 3_600_000;
                  return (
                    <TableRow key={e.id} className="hover:bg-secondary/40">
                      <TableCell className="py-2">
                        <div className="flex items-center gap-2">
                          <span
                            className="size-2 rounded-full"
                            style={{ backgroundColor: company?.color ?? "#71717A" }}
                          />
                          <span className="text-sm">{company?.name ?? "—"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-2 text-sm text-muted-foreground">
                        {formatDateTime(e.startedAt)}
                      </TableCell>
                      <TableCell className="py-2 text-sm font-medium">{formatHours(hours)}</TableCell>
                      <TableCell className="py-2">
                        <span
                          className={`text-xs ${e.billable ? "text-success" : "text-muted-foreground-2"}`}
                        >
                          {e.billable ? "Billable" : "Non-billable"}
                        </span>
                      </TableCell>
                      <TableCell className="py-2 text-sm text-muted-foreground">{e.note ?? "—"}</TableCell>
                      <TableCell className="py-2 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-muted-foreground-2 hover:text-danger"
                          onClick={() => deleteTimeEntry(workspace!.id, e.id)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {workspace && user && (
        <ManualEntryDialog
          open={manualOpen}
          onOpenChange={setManualOpen}
          workspaceId={workspace.id}
          memberId={user.uid}
          companies={companies}
        />
      )}
    </>
  );
}

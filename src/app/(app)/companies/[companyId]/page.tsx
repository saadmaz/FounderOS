"use client";

import { ArrowLeft, CheckSquare, Clock, FolderKanban, Globe, Link2, Pencil, Plus } from "lucide-react";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FacebookLogo,
  InstagramLogo,
  LinkedinLogo,
  TiktokLogo,
  XLogo,
  YoutubeLogo,
} from "@/components/shared/brand-icons";
import { DetailPageSkeleton } from "@/components/shared/detail-page-skeleton";
import { ScrollableTabStrip } from "@/components/shared/scrollable-tabs";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { CompanyClockWidget } from "@/components/companies/company-clock-widget";
import { CompanyFormDialog } from "@/components/companies/company-form-dialog";
import { CompanyCrmPanel } from "@/components/companies/company-crm-panel";
import { CompanyDocumentsPanel } from "@/components/companies/company-documents-panel";
import { CompanyFinancePanel } from "@/components/companies/company-finance-panel";
import { CompanyMeetingsPanel } from "@/components/companies/company-meetings-panel";
import { CompanyNotesPanel } from "@/components/companies/company-notes-panel";
import { ProjectFormDialog } from "@/components/projects/project-form-dialog";
import { ProjectList } from "@/components/projects/project-list";
import { TaskFormDialog } from "@/components/tasks/task-form-dialog";
import { TaskTable } from "@/components/tasks/task-table";
import { useCompanies } from "@/lib/data/companies";
import { useMeetings } from "@/lib/data/meetings";
import { useProjects } from "@/lib/data/projects";
import { useTasks } from "@/lib/data/tasks";
import { useTimeEntries } from "@/lib/data/time-entries";
import { formatHours, sumHours, sumMeetingHours } from "@/lib/format";
import { companyTypeLabel } from "@/lib/labels";
import { scrollMainToTop } from "@/lib/scroll";
import { useWorkspace } from "@/lib/workspace/workspace-provider";

const LINK_ICONS = {
  website: Globe,
  linkedin: LinkedinLogo,
  twitter: XLogo,
  instagram: InstagramLogo,
  facebook: FacebookLogo,
  tiktok: TiktokLogo,
  youtube: YoutubeLogo,
  other: Link2,
} as const;

// Rendered next to each link pill's icon - hardcoded rather than
// `capitalize`-ing the object key so "twitter" reads "X" and "tiktok"/
// "youtube" get their proper brand casing instead of "Tiktok"/"Youtube".
const LINK_LABELS: Record<keyof typeof LINK_ICONS, string> = {
  website: "Website",
  linkedin: "LinkedIn",
  twitter: "X",
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  youtube: "YouTube",
  other: "Other",
};

const COMPANY_TABS = [
  "overview",
  "projects",
  "tasks",
  "meetings",
  "finance",
  "crm",
  "documents",
  "notes",
] as const;

// Same rationale as LINK_LABELS above - `capitalize` on the raw tab value
// turns "crm" into "Crm" instead of the acronym "CRM", so it needs an
// explicit label rather than a CSS transform.
const TAB_LABELS: Record<(typeof COMPANY_TABS)[number], string> = {
  overview: "Overview",
  projects: "Projects",
  tasks: "Tasks",
  meetings: "Meetings",
  finance: "Finance",
  crm: "CRM",
  documents: "Documents",
  notes: "Notes",
};

export default function CompanyDetailPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const { workspace } = useWorkspace();
  const { data: companies, loading: companiesLoading } = useCompanies(workspace?.id ?? null);
  const { data: projects } = useProjects(workspace?.id ?? null, companyId);
  const { data: tasks } = useTasks(workspace?.id ?? null, companyId);
  const { data: timeEntries } = useTimeEntries(workspace?.id ?? null);
  const { data: meetings } = useMeetings(workspace?.id ?? null, companyId);
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const company = companies.find((c) => c.id === companyId);

  // Hours logged = timer/manual entries + completed meetings - a meeting is
  // time spent same as any other session, so it counts toward the total.
  const hours = useMemo(
    () => sumHours(timeEntries.filter((e) => e.companyId === companyId)) + sumMeetingHours(meetings),
    [timeEntries, meetings, companyId]
  );
  const openTasks = tasks.filter((t) => t.status !== "completed" && t.status !== "cancelled").length;
  const activeProjects = projects.filter(
    (p) => p.status !== "completed" && p.status !== "cancelled"
  ).length;

  if (companiesLoading) {
    return <DetailPageSkeleton avatar tabs={8} />;
  }
  if (!company) return notFound();

  return (
    <>
      <div className="border-b border-border px-4 py-4 lg:px-6">
        <Link
          href="/companies"
          className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          All companies
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <Avatar size="lg" className="size-12 rounded-xl">
              <AvatarImage src={company.logoUrl} className="rounded-xl" />
              <AvatarFallback
                className="rounded-xl text-lg font-semibold text-white"
                style={{ backgroundColor: company.color }}
              >
                {company.name[0]}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight">{company.name}</h1>
                <StatusBadge status={company.status} />
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {company.industry ?? "—"} · {companyTypeLabel(company.type)} ·{" "}
                <span className="capitalize">{company.stage.replace("-", " ")}</span>
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEditDialogOpen(true)}>
            <Pencil className="size-3.5" />
            Edit
          </Button>
        </div>

        {company.description && (
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground">{company.description}</p>
        )}

        {company.links && Object.values(company.links).some(Boolean) && (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {(Object.entries(company.links) as [keyof typeof LINK_ICONS, string | undefined][])
              .filter(([, url]) => Boolean(url))
              .map(([key, url]) => {
                const Icon = LINK_ICONS[key];
                return (
                  <a
                    key={key}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-border-hover hover:text-foreground"
                  >
                    <Icon className="size-3.5" />
                    <span>{LINK_LABELS[key]}</span>
                  </a>
                );
              })}
          </div>
        )}

        <div className="mt-5 grid grid-cols-3 gap-3 sm:max-w-md">
          <StatCard label="Open Tasks" value={String(openTasks)} icon={CheckSquare} accent="text-warning" accentBg="bg-warning/10" />
          <StatCard label="Active Projects" value={String(activeProjects)} icon={FolderKanban} accent="text-analytics-purple" accentBg="bg-analytics-purple/10" />
          <StatCard label="Hours Logged" value={formatHours(hours)} icon={Clock} accent="text-analytics-pink" accentBg="bg-analytics-pink/10" />
        </div>
      </div>

      <Tabs defaultValue="overview" className="flex flex-1 flex-col gap-0" onValueChange={scrollMainToTop}>
        <ScrollableTabStrip className="border-b border-border px-4 lg:px-6">
          <TabsList className="h-11 w-max bg-transparent p-0">
            {COMPANY_TABS.map((v) => (
              <TabsTrigger
                key={v}
                value={v}
                // 7 tabs at once always needs to scroll somewhere - tighter
                // padding on mobile just means less of that scrolling to do.
                className="shrink-0 rounded-none border-b-2 border-transparent px-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none sm:px-3"
              >
                {TAB_LABELS[v]}
              </TabsTrigger>
            ))}
          </TabsList>
        </ScrollableTabStrip>

        <TabsContent value="overview" className="flex-1 space-y-6 p-4 lg:p-6">
          {company.type === "work" && <CompanyClockWidget company={company} />}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <section>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold">Recent Projects</h2>
                <Button variant="ghost" size="sm" onClick={() => setProjectDialogOpen(true)}>
                  <Plus className="size-3.5" /> Add
                </Button>
              </div>
              <ProjectList
                projects={projects.slice(0, 5)}
                companies={companies}
                tasks={tasks}
                workspaceId={workspace!.id}
                showCompany={false}
              />
            </section>
            <section>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold">Recent Tasks</h2>
                <Button variant="ghost" size="sm" onClick={() => setTaskDialogOpen(true)}>
                  <Plus className="size-3.5" /> Add
                </Button>
              </div>
              <TaskTable
                tasks={tasks.slice(0, 8)}
                companies={companies}
                workspaceId={workspace!.id}
                showCompany={false}
              />
            </section>
          </div>
        </TabsContent>

        <TabsContent value="projects" className="flex-1 p-4 lg:p-6">
          <div className="mb-3 flex justify-end">
            <Button size="sm" onClick={() => setProjectDialogOpen(true)} className="gap-1.5">
              <Plus className="size-3.5" /> New project
            </Button>
          </div>
          <ProjectList projects={projects} companies={companies} tasks={tasks} workspaceId={workspace!.id} showCompany={false} />
        </TabsContent>

        <TabsContent value="tasks" className="flex-1 p-4 lg:p-6">
          <div className="mb-3 flex justify-end">
            <Button size="sm" onClick={() => setTaskDialogOpen(true)} className="gap-1.5">
              <Plus className="size-3.5" /> New task
            </Button>
          </div>
          <TaskTable tasks={tasks} companies={companies} workspaceId={workspace!.id} showCompany={false} />
        </TabsContent>

        <TabsContent value="meetings" className="flex min-w-0 flex-1">
          <CompanyMeetingsPanel company={company} />
        </TabsContent>
        <TabsContent value="finance" className="flex min-w-0 flex-1">
          <CompanyFinancePanel company={company} />
        </TabsContent>
        <TabsContent value="crm" className="flex min-w-0 flex-1">
          <CompanyCrmPanel company={company} />
        </TabsContent>
        <TabsContent value="documents" className="flex min-w-0 flex-1">
          <CompanyDocumentsPanel company={company} />
        </TabsContent>
        <TabsContent value="notes" className="flex min-w-0 flex-1">
          <CompanyNotesPanel company={company} />
        </TabsContent>
      </Tabs>

      <ProjectFormDialog open={projectDialogOpen} onOpenChange={setProjectDialogOpen} defaultCompanyId={companyId} />
      <TaskFormDialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen} defaultCompanyId={companyId} />
      <CompanyFormDialog open={editDialogOpen} onOpenChange={setEditDialogOpen} company={company} />
    </>
  );
}

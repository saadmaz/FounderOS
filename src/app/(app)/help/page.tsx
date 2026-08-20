"use client";

import {
  BarChart3,
  BookOpen,
  Building2,
  Calendar,
  Clock,
  FileText,
  FolderKanban,
  Keyboard,
  Lightbulb,
  LayoutGrid,
  Mail,
  Target,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { useAuth } from "@/lib/auth/auth-provider";

const GUIDE_SECTIONS: { icon: LucideIcon; title: string; description: string }[] = [
  {
    icon: Building2,
    title: "Companies",
    description:
      "The hub everything else hangs off of. Each company gets its own Overview, Projects, Tasks, Finance, CRM, and Documents tabs, scoped to just that business.",
  },
  {
    icon: FolderKanban,
    title: "Projects & Tasks",
    description:
      "Projects roll up tasks; tasks can be worked as a board or a table and belong to a company and (optionally) a project.",
  },
  {
    icon: Calendar,
    title: "Calendar",
    description: "Events, deadlines, and reminders across every company in one view.",
  },
  {
    icon: Clock,
    title: "Time Tracking",
    description: "Run a live timer or log time manually against a company or project; billable hours are flagged separately.",
  },
  {
    icon: Wallet,
    title: "Finance",
    description:
      "What you've put into each company - expenses (and whether you're reimbursed), investments, budgets, and vendors. Workspace-wide on the Finance page, or scoped to one company from its detail page.",
  },
  {
    icon: Users,
    title: "CRM",
    description: "Contacts and a drag-and-drop deal pipeline, workspace-wide or scoped to a single company.",
  },
  {
    icon: LayoutGrid,
    title: "Meetings",
    description: "Schedule meetings with attendees, an agenda, and notes; mark them completed or cancelled.",
  },
  {
    icon: FileText,
    title: "Documents",
    description: "Upload contracts, proposals, and assets; attach them to a company or keep them workspace-wide.",
  },
  {
    icon: Target,
    title: "Goals",
    description: "Track objectives with a status and target date, workspace-wide.",
  },
  {
    icon: Lightbulb,
    title: "Ideas",
    description: "Capture and triage new ideas before they become projects.",
  },
  {
    icon: BookOpen,
    title: "Learning",
    description: "Keep a running list of resources, courses, and notes worth revisiting.",
  },
  {
    icon: BarChart3,
    title: "Analytics",
    description: "A rollup of activity across companies — tasks, time, and finance trends.",
  },
];

const SHORTCUTS: { keys: string[]; description: string }[] = [
  { keys: ["Ctrl", "K"], description: "Open the command palette to jump to any page or company" },
  { keys: ["Esc"], description: "Close the command palette or the open dialog" },
];

export default function HelpPage() {
  const { user } = useAuth();
  const feedbackHref = `mailto:${user?.email ?? ""}?subject=${encodeURIComponent(
    "FounderOS feedback"
  )}`;

  return (
    <>
      <PageHeader title="Help & Support" description="Guides, shortcuts, and a way to leave yourself feedback." />

      <div className="flex-1 space-y-8 p-4 lg:p-6">
        <section>
          <h2 className="text-sm font-semibold">Feature guide</h2>
          <p className="mt-1 text-sm text-muted-foreground">What each section of the sidebar is for.</p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {GUIDE_SECTIONS.map((s) => (
              <div key={s.title} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-2.5">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <s.icon className="size-4" />
                  </span>
                  <h3 className="text-sm font-medium">{s.title}</h3>
                </div>
                <p className="mt-2.5 text-xs text-muted-foreground">{s.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Keyboard className="size-4 text-muted-foreground" />
            Keyboard shortcuts
          </h2>
          <div className="mt-4 max-w-md overflow-hidden rounded-xl border border-border">
            {SHORTCUTS.map((s, i) => (
              <div
                key={s.description}
                className={`flex items-center justify-between gap-4 px-4 py-2.5 ${
                  i > 0 ? "border-t border-border" : ""
                }`}
              >
                <span className="text-sm text-muted-foreground">{s.description}</span>
                <span className="flex shrink-0 gap-1">
                  {s.keys.map((k) => (
                    <kbd
                      key={k}
                      className="rounded-md border border-border bg-secondary px-1.5 py-0.5 text-xs font-medium"
                    >
                      {k}
                    </kbd>
                  ))}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Mail className="size-4 text-muted-foreground" />
            Feedback
          </h2>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Hit a bug or have an idea for FounderOS? Send yourself a note so it doesn&apos;t get lost.
          </p>
          <a
            href={feedbackHref}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium transition-colors hover:border-border-hover"
          >
            <Mail className="size-3.5" />
            Email feedback to yourself
          </a>
        </section>
      </div>
    </>
  );
}

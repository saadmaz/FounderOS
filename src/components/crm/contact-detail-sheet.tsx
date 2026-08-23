"use client";

import {
  Download,
  FileText,
  Mail,
  MessageSquare,
  Phone,
  Plus,
  StickyNote,
  Trash2,
  TrendingUp,
  Users as UsersIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { LinkedinLogo } from "@/components/shared/brand-icons";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth/auth-provider";
import { useConfirm } from "@/lib/confirm/confirm-provider";
import { useCompanies } from "@/lib/data/companies";
import {
  addContactActivity,
  deleteContact,
  deleteContactActivity,
  updateContact,
  useContactActivity,
} from "@/lib/data/contacts";
import { deleteDocument, useDocumentsByContact } from "@/lib/data/documents";
import { useDealsByContact } from "@/lib/data/deals";
import { useMembers } from "@/lib/data/members";
import { setTaskStatus, useTasksByContact, createTask, deleteTask } from "@/lib/data/tasks";
import { DocumentFormDialog } from "@/components/documents/document-form-dialog";
import { DealFormDialog } from "@/components/crm/deal-form-dialog";
import { SectionLabel } from "@/components/crm/section-label";
import { formatCurrency, formatDate, formatDateTime, formatFileSize, initials, toDateInputValue } from "@/lib/format";
import {
  CONTACT_SOURCES,
  DEAL_STAGES,
  type Contact,
  type ContactActivityType,
  type Deal,
  type DocumentFile,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/lib/workspace/workspace-provider";

function toDateInput(ms: number | null | undefined) {
  if (!ms) return "";
  return toDateInputValue(ms);
}

function fromDateInput(v: string): number | null {
  return v ? new Date(`${v}T00:00:00`).getTime() : null;
}

type Draft = {
  name: string;
  companyId: string;
  title: string;
  prospectCompany: string;
  phone: string;
  email: string;
  linkedin: string;
  source: string;
  ownerId: string;
  status: Contact["status"];
  lastContactedAt: string;
};

function draftFrom(contact: Contact): Draft {
  return {
    name: contact.name,
    companyId: contact.companyId,
    title: contact.title ?? "",
    prospectCompany: contact.prospectCompany ?? "",
    phone: contact.phone ?? "",
    email: contact.email ?? "",
    linkedin: contact.linkedin ?? "",
    source: contact.source ?? "",
    ownerId: contact.ownerId ?? "",
    status: contact.status,
    lastContactedAt: toDateInput(contact.lastContactedAt),
  };
}


const ACTIVITY_TYPES: { value: ContactActivityType; label: string; icon: typeof StickyNote }[] = [
  { value: "note", label: "Note", icon: StickyNote },
  { value: "call", label: "Call", icon: Phone },
  { value: "email", label: "Email", icon: Mail },
  { value: "meeting", label: "Meeting", icon: UsersIcon },
];

const ACTIVITY_ICON: Record<string, typeof StickyNote> = {
  note: StickyNote,
  call: Phone,
  email: Mail,
  meeting: UsersIcon,
  created: Plus,
};

const ACTIVITY_ICON_COLOR: Record<string, string> = {
  note: "text-analytics-orange",
  call: "text-success",
  email: "text-primary",
  meeting: "text-analytics-purple",
  created: "text-muted-foreground",
};

const ACTIVITY_ICON_BG: Record<string, string> = {
  note: "bg-analytics-orange/10",
  call: "bg-success/10",
  email: "bg-primary/10",
  meeting: "bg-analytics-purple/10",
  created: "bg-secondary",
};

/**
 * The full contact workspace: editable properties plus tabs for everything
 * tied back to this person - timeline, open tasks, attached documents, and
 * the deals they're the contact on. Mirrors DealDetailSheet's editing
 * pattern (per-field autosave, no submit button) - see that file for the
 * render-time-reset rationale.
 */
export function ContactDetailSheet({
  open,
  onOpenChange,
  contact,
  onOpenDeal,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contact: Contact | null;
  /** Lets the CRM Deals tab hand off to DealDetailSheet at the page level
   * instead of stacking a second sheet on top of this one. */
  onOpenDeal?: (deal: Deal) => void;
}) {
  const { workspace } = useWorkspace();
  const { user } = useAuth();
  const confirm = useConfirm();
  const { data: companies } = useCompanies(workspace?.id ?? null);
  const { data: members } = useMembers(workspace?.id ?? null);

  const sessionKey = open ? (contact?.id ?? "none") : "closed";
  const [seededKey, setSeededKey] = useState(sessionKey);
  const [draft, setDraft] = useState<Draft | null>(contact ? draftFrom(contact) : null);
  const [activityType, setActivityType] = useState<ContactActivityType>("note");
  const [activityText, setActivityText] = useState("");
  const [activityDate, setActivityDate] = useState(() => toDateInput(Date.now()));
  const [posting, setPosting] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDate, setNewTaskDate] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [dealDialogOpen, setDealDialogOpen] = useState(false);

  if (sessionKey !== seededKey) {
    setSeededKey(sessionKey);
    setDraft(contact ? draftFrom(contact) : null);
    setActivityType("note");
    setActivityText("");
    setNewTaskTitle("");
    setNewTaskDate("");
  }

  // Date.now() is impure, so the "today" default for a fresh session is set
  // here rather than in the render-time reset block above.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActivityDate(toDateInput(Date.now()));
  }, [sessionKey]);

  const { data: activity, loading: activityLoading } = useContactActivity(
    workspace?.id ?? null,
    contact?.id ?? null
  );
  const { data: tasks } = useTasksByContact(workspace?.id ?? null, contact?.id ?? null);
  const { data: documents } = useDocumentsByContact(workspace?.id ?? null, contact?.id ?? null);
  const { data: deals } = useDealsByContact(workspace?.id ?? null, contact?.id ?? null);
  const companyById = new Map(companies.map((c) => [c.id, c]));
  const memberById = new Map(members.map((m) => [m.id, m]));

  if (!contact || !draft) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full p-0 sm:max-w-xl lg:max-w-2xl" />
      </Sheet>
    );
  }

  async function commit(patch: Partial<Contact>) {
    if (!workspace || !contact) return;
    try {
      await updateContact(workspace.id, contact.id, patch);
    } catch (err) {
      console.error("Contact update failed:", err);
      toast.error(err instanceof Error ? err.message : "Couldn't save. Try again.");
    }
  }

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  }

  async function handleDelete() {
    if (!workspace || !contact) return;
    if (!(await confirm(`Delete "${contact.name}"? This can't be undone.`))) return;
    try {
      await deleteContact(workspace.id, contact.id);
      toast.success("Contact deleted");
      onOpenChange(false);
    } catch {
      toast.error("Couldn't delete the contact. Try again.");
    }
  }

  async function handlePostActivity() {
    if (!workspace || !contact || !user || !activityText.trim()) return;
    setPosting(true);
    try {
      await addContactActivity(workspace.id, {
        contactId: contact.id,
        type: activityType,
        text: activityText.trim(),
        date: fromDateInput(activityDate) ?? undefined,
        authorId: user.uid,
      });
      setActivityText("");
      setActivityDate(toDateInput(Date.now()));
    } catch {
      toast.error("Couldn't log that. Try again.");
    } finally {
      setPosting(false);
    }
  }

  async function handleAddTask() {
    if (!workspace || !contact || !newTaskTitle.trim()) return;
    try {
      await createTask(workspace.id, {
        companyId: contact.companyId,
        contactId: contact.id,
        title: newTaskTitle.trim(),
        status: "not_started",
        priority: "medium",
        dueDate: fromDateInput(newTaskDate),
      });
      setNewTaskTitle("");
      setNewTaskDate("");
    } catch {
      toast.error("Couldn't add that task. Try again.");
    }
  }

  async function handleDownloadDocument(doc: DocumentFile) {
    window.open(doc.url, "_blank", "noopener,noreferrer");
  }

  async function handleDeleteDocument(doc: DocumentFile) {
    if (!workspace) return;
    if (!(await confirm(`Delete "${doc.name}"? This can't be undone.`))) return;
    try {
      await deleteDocument(workspace.id, doc);
      toast.success(`${doc.name} deleted`);
    } catch {
      toast.error("Couldn't delete the file. Try again.");
    }
  }

  const company = companyById.get(draft.companyId);
  const owner = draft.ownerId ? memberById.get(draft.ownerId) : undefined;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-xl lg:max-w-2xl">
        {/* Header */}
        <div className="space-y-3.5 border-b border-border p-5 lg:p-6">
          <div className="flex items-start gap-3 pr-8">
            <Avatar size="lg" className="size-12 shrink-0 lg:size-14">
              <AvatarFallback
                className="text-base font-semibold"
                style={
                  company
                    ? { backgroundColor: `${company.color}1f`, color: company.color }
                    : undefined
                }
              >
                {initials(draft.name || contact.name)}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0 flex-1 space-y-1 pt-1">
              <Input
                value={draft.name}
                onChange={(e) => set("name", e.target.value)}
                onBlur={() => commit({ name: draft.name.trim() || contact.name })}
                className="-ml-2 h-auto rounded-lg border border-transparent bg-transparent px-2 py-0.5 text-lg font-semibold shadow-none hover:bg-secondary/50 focus-visible:bg-transparent"
              />
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1.5 px-2 text-xs text-muted-foreground">
                {company && (
                  <span className="flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full" style={{ backgroundColor: company.color }} />
                    {company.name}
                  </span>
                )}
                {(draft.title || draft.prospectCompany) && (
                  <span className="truncate">
                    ·{" "}
                    {draft.title && draft.prospectCompany
                      ? `${draft.title} at ${draft.prospectCompany}`
                      : (draft.title || draft.prospectCompany)}
                  </span>
                )}
                {owner && (
                  <span className="ml-auto flex shrink-0 items-center gap-1.5 rounded-full bg-secondary/60 py-1 pr-2.5 pl-1 text-muted-foreground">
                    <Avatar size="sm" className="size-5">
                      {owner.photoURL && <AvatarImage src={owner.photoURL} alt={owner.displayName} />}
                      <AvatarFallback className="text-[9px]">{initials(owner.displayName)}</AvatarFallback>
                    </Avatar>
                    {owner.displayName}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {draft.email && (
              <a
                href={`mailto:${draft.email}`}
                className="flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-border-hover hover:text-foreground"
              >
                <Mail className="size-3.5 text-primary" />
                {draft.email}
              </a>
            )}
            {draft.phone && (
              <a
                href={`tel:${draft.phone}`}
                className="flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-border-hover hover:text-foreground"
              >
                <Phone className="size-3.5 text-success" />
                {draft.phone}
              </a>
            )}
            {draft.linkedin && (
              <a
                href={draft.linkedin.startsWith("http") ? draft.linkedin : `https://${draft.linkedin}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-border-hover hover:text-foreground"
              >
                <LinkedinLogo className="size-3.5 text-analytics-cyan" />
                LinkedIn
              </a>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
          {/* Properties */}
          <div className="order-2 shrink-0 space-y-3 border-t border-border p-4 lg:w-72 lg:overflow-y-auto lg:border-t-0 lg:border-l lg:p-5">
            <SectionLabel>Contact info</SectionLabel>

            <div className="space-y-1.5">
              <Label>Company</Label>
              <Select
                value={draft.companyId}
                onValueChange={(v) => {
                  set("companyId", v ?? draft.companyId);
                  if (v) commit({ companyId: v });
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>{() => company?.name ?? "Select company"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="contact-title">Job title</Label>
              <Input
                id="contact-title"
                value={draft.title}
                onChange={(e) => set("title", e.target.value)}
                onBlur={() => commit({ title: draft.title || undefined })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="contact-prospect-company">Prospect company</Label>
              <Input
                id="contact-prospect-company"
                placeholder="Acme Corp"
                value={draft.prospectCompany}
                onChange={(e) => set("prospectCompany", e.target.value)}
                onBlur={() => commit({ prospectCompany: draft.prospectCompany || undefined })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="contact-phone">Mobile number</Label>
              <Input
                id="contact-phone"
                type="tel"
                value={draft.phone}
                onChange={(e) => set("phone", e.target.value)}
                onBlur={() => commit({ phone: draft.phone || undefined })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="contact-email">Email</Label>
              <Input
                id="contact-email"
                type="email"
                value={draft.email}
                onChange={(e) => set("email", e.target.value)}
                onBlur={() => commit({ email: draft.email || undefined })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="contact-linkedin">LinkedIn</Label>
              <Input
                id="contact-linkedin"
                placeholder="linkedin.com/in/…"
                value={draft.linkedin}
                onChange={(e) => set("linkedin", e.target.value)}
                onBlur={() => commit({ linkedin: draft.linkedin || undefined })}
              />
            </div>

            <SectionLabel>Lead details</SectionLabel>

            <div className="space-y-1.5">
              <Label htmlFor="contact-source">Lead source</Label>
              <Input
                id="contact-source"
                list="contact-source-suggestions"
                placeholder="e.g. Referral"
                value={draft.source}
                onChange={(e) => set("source", e.target.value)}
                onBlur={() => commit({ source: draft.source || undefined })}
              />
              <datalist id="contact-source-suggestions">
                {CONTACT_SOURCES.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>

            <div className="space-y-1.5">
              <Label>Contact owner</Label>
              <Select
                value={draft.ownerId || "none"}
                onValueChange={(v) => {
                  const next = v === "none" ? "" : (v ?? "");
                  set("ownerId", next);
                  commit({ ownerId: next || undefined });
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>{() => owner?.displayName ?? "Unassigned"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={draft.status}
                onValueChange={(v) => {
                  const next = (v ?? draft.status) as Contact["status"];
                  set("status", next);
                  commit({ status: next });
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>{() => (draft.status === "active" ? "Active" : "Inactive")}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Last contacted</Label>
              <DatePicker
                value={draft.lastContactedAt}
                onChange={(v) => {
                  set("lastContactedAt", v);
                  commit({ lastContactedAt: fromDateInput(v) });
                }}
              />
            </div>

            <div className="border-t border-border pt-3">
              <Button
                type="button"
                variant="ghost"
                className="w-full gap-1.5 text-danger hover:bg-danger/10 hover:text-danger"
                onClick={handleDelete}
              >
                <Trash2 className="size-3.5" />
                Delete contact
              </Button>
            </div>
          </div>

          {/* Tabs: Timeline / Tasks / Documents / Deals */}
          <div className="order-1 flex-1 p-4 lg:overflow-y-auto lg:p-5">
            <Tabs defaultValue="timeline">
              <TabsList>
                <TabsTrigger value="timeline">Timeline</TabsTrigger>
                <TabsTrigger value="tasks">
                  Tasks{tasks.length > 0 ? ` (${tasks.length})` : ""}
                </TabsTrigger>
                <TabsTrigger value="documents">
                  Documents{documents.length > 0 ? ` (${documents.length})` : ""}
                </TabsTrigger>
                <TabsTrigger value="deals">Deals{deals.length > 0 ? ` (${deals.length})` : ""}</TabsTrigger>
              </TabsList>

              {/* ----- Timeline ----- */}
              <TabsContent value="timeline" className="space-y-4 pt-3">
                <div className="space-y-2.5 rounded-xl border border-border bg-surface/50 p-3.5 shadow-sm">
                  <div className="flex gap-1.5">
                    {ACTIVITY_TYPES.map((t) => (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setActivityType(t.value)}
                        className={cn(
                          "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                          activityType === t.value
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:border-border-hover hover:text-foreground"
                        )}
                      >
                        <t.icon className="size-3.5" />
                        {t.label}
                      </button>
                    ))}
                  </div>
                  <Textarea
                    rows={2}
                    placeholder={activityType === "note" ? "Add a note…" : `Log this ${activityType}…`}
                    value={activityText}
                    onChange={(e) => setActivityText(e.target.value)}
                  />
                  <div className="flex items-center justify-between gap-2">
                    <DatePicker
                      value={activityDate}
                      onChange={setActivityDate}
                      className="h-7 w-32 text-xs"
                    />
                    <Button
                      type="button"
                      size="sm"
                      disabled={posting || !activityText.trim()}
                      onClick={handlePostActivity}
                    >
                      {posting ? "Logging…" : "Log"}
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  {activityLoading ? (
                    <p className="text-sm text-muted-foreground">Loading activity…</p>
                  ) : activity.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No activity yet - log a call, email, or note above.
                    </p>
                  ) : (
                    activity.map((a, i) => {
                      const Icon = ACTIVITY_ICON[a.type] ?? MessageSquare;
                      const isSystem = a.type === "created";
                      return (
                        <div
                          key={a.id}
                          className="group -mx-2 flex gap-2.5 rounded-lg px-2 py-1 transition-colors hover:bg-secondary/40"
                        >
                          <span
                            className={cn(
                              "relative mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full",
                              ACTIVITY_ICON_BG[a.type] ?? "bg-secondary",
                            )}
                          >
                            <Icon className={cn("size-3.5", ACTIVITY_ICON_COLOR[a.type] ?? "text-muted-foreground")} />
                            {i < activity.length - 1 && (
                              <span className="absolute top-full left-1/2 h-3 w-px -translate-x-1/2 bg-border" />
                            )}
                          </span>
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <span>
                                {a.type === "created" ? "Contact created" : `Logged a ${a.type}`}
                              </span>
                              <span>·</span>
                              <span>{a.date ? formatDate(a.date) : formatDateTime(a.createdAt)}</span>
                            </div>
                            {a.text && <p className="wrap-break-word text-sm">{a.text}</p>}
                          </div>
                          {!isSystem && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-6 shrink-0 opacity-0 group-hover:opacity-100"
                              aria-label="Remove entry"
                              onClick={() =>
                                workspace &&
                                deleteContactActivity(workspace.id, a.id).catch(() =>
                                  toast.error("Couldn't remove that entry.")
                                )
                              }
                            >
                              <Trash2 className="size-3" />
                            </Button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </TabsContent>

              {/* ----- Tasks ----- */}
              <TabsContent value="tasks" className="space-y-3 pt-3">
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Follow up about…"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddTask()}
                  />
                  <div className="w-36 shrink-0">
                    <DatePicker value={newTaskDate} onChange={setNewTaskDate} placeholder="Due" />
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    className="shrink-0"
                    disabled={!newTaskTitle.trim()}
                    onClick={handleAddTask}
                    aria-label="Add task"
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>

                {tasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No follow-ups yet - add one above.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {tasks.map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center gap-2.5 rounded-lg border border-border px-3 py-2"
                      >
                        <Checkbox
                          checked={t.status === "completed"}
                          onCheckedChange={(checked) =>
                            workspace &&
                            setTaskStatus(workspace.id, t.id, checked ? "completed" : "not_started")
                          }
                        />
                        <span
                          className={cn(
                            "min-w-0 flex-1 truncate text-sm",
                            t.status === "completed" && "text-muted-foreground line-through"
                          )}
                        >
                          {t.title}
                        </span>
                        {t.dueDate && (
                          <span className="shrink-0 text-xs text-muted-foreground-2">
                            {formatDate(t.dueDate)}
                          </span>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-6 shrink-0 text-muted-foreground-2 hover:text-danger"
                          aria-label="Delete task"
                          onClick={() => workspace && deleteTask(workspace.id, t.id)}
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* ----- Documents ----- */}
              <TabsContent value="documents" className="space-y-3 pt-3">
                <div className="flex justify-end">
                  <Button type="button" size="sm" className="gap-1.5" onClick={() => setUploadOpen(true)}>
                    <Plus className="size-4" />
                    Upload
                  </Button>
                </div>

                {documents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No documents attached yet.</p>
                ) : (
                  <div className="space-y-1.5">
                    {documents.map((d) => (
                      <div
                        key={d.id}
                        className="flex items-center gap-2.5 rounded-lg border border-border px-3 py-2"
                      >
                        <FileText className="size-4 shrink-0 text-analytics-orange" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{d.name}</p>
                          <p className="text-xs text-muted-foreground">{formatFileSize(d.size)}</p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-6 shrink-0 text-muted-foreground-2 hover:text-foreground"
                          aria-label="Download document"
                          onClick={() => handleDownloadDocument(d)}
                        >
                          <Download className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-6 shrink-0 text-muted-foreground-2 hover:text-danger"
                          aria-label="Delete document"
                          onClick={() => handleDeleteDocument(d)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* ----- Deals ----- */}
              <TabsContent value="deals" className="space-y-3 pt-3">
                <div className="flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setDealDialogOpen(true)}
                  >
                    <Plus className="size-4" />
                    New deal
                  </Button>
                </div>

                {deals.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No deals linked to {contact.name} yet.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {deals.map((d) => {
                      const stage = DEAL_STAGES.find((s) => s.value === d.stage);
                      return (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => onOpenDeal?.(d)}
                          className="flex w-full items-center gap-2.5 rounded-lg border border-border px-3 py-2 text-left transition-colors hover:border-border-hover"
                        >
                          <TrendingUp className="size-4 shrink-0 text-muted-foreground" />
                          <span className="min-w-0 flex-1 truncate text-sm font-medium">{d.title}</span>
                          <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                            {stage?.label ?? d.stage}
                          </span>
                          <span className="shrink-0 text-sm font-semibold tabular-nums">
                            {formatCurrency(d.value, d.currency)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </SheetContent>

      {workspace && (
        <>
          <DocumentFormDialog
            open={uploadOpen}
            onOpenChange={setUploadOpen}
            workspaceId={workspace.id}
            companies={companies}
            defaultCompanyId={contact.companyId}
            contactId={contact.id}
          />
          <DealFormDialog
            open={dealDialogOpen}
            onOpenChange={setDealDialogOpen}
            defaultCompanyId={contact.companyId}
            defaultContactId={contact.id}
            onCreated={(dealId) => {
              const created = deals.find((d) => d.id === dealId);
              if (created) onOpenDeal?.(created);
            }}
          />
        </>
      )}
    </Sheet>
  );
}

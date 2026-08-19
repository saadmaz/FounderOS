"use client";

import {
  Mail,
  MessageSquare,
  Phone,
  Plus,
  StickyNote,
  Trash2,
  Users as UsersIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { SectionLabel } from "@/components/crm/section-label";
import { useAuth } from "@/lib/auth/auth-provider";
import { useCompanies } from "@/lib/data/companies";
import { useContacts } from "@/lib/data/contacts";
import {
  addDealActivity,
  deleteDeal,
  deleteDealActivity,
  updateDeal,
  updateDealStage,
  useDealActivity,
} from "@/lib/data/deals";
import { formatCurrency, formatDateTime, initials } from "@/lib/format";
import {
  DEAL_SOURCES,
  DEAL_STAGES,
  type Deal,
  type DealActivityType,
  type WorkspaceMember,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/lib/workspace/workspace-provider";

function toDateInput(ms: number | null | undefined) {
  if (!ms) return "";
  return new Date(ms).toISOString().slice(0, 10);
}

function fromDateInput(v: string): number | null {
  return v ? new Date(v).getTime() : null;
}

type Draft = {
  title: string;
  companyId: string;
  contactId: string;
  value: string;
  currency: string;
  probability: string;
  expectedCloseDate: string;
  ownerId: string;
  source: string;
  exitCriteria: string;
  nextStep: string;
  nextStepDate: string;
};

function draftFrom(deal: Deal): Draft {
  return {
    title: deal.title,
    companyId: deal.companyId,
    contactId: deal.contactId ?? "",
    value: String(deal.value),
    currency: deal.currency,
    probability: deal.probability != null ? String(deal.probability) : "",
    expectedCloseDate: toDateInput(deal.expectedCloseDate),
    ownerId: deal.ownerId ?? "",
    source: deal.source ?? "",
    exitCriteria: deal.exitCriteria ?? "",
    nextStep: deal.nextStep ?? "",
    nextStepDate: toDateInput(deal.nextStepDate),
  };
}

const ACTIVITY_TYPES: { value: DealActivityType; label: string; icon: typeof StickyNote }[] = [
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
  stage_change: MessageSquare,
  created: Plus,
};

/**
 * The full deal workspace: editable properties, a stage stepper, and an
 * activity/notes timeline - opened by clicking a card on the board.
 * Properties save individually (per-field, on blur/change) rather than via
 * a single form submit, so it reads as a live record you're editing in
 * place rather than a form you fill out and confirm.
 */
export function DealDetailSheet({
  open,
  onOpenChange,
  deal,
  members,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  deal: Deal | null;
  members: WorkspaceMember[];
}) {
  const { workspace } = useWorkspace();
  const { user } = useAuth();
  const { data: companies } = useCompanies(workspace?.id ?? null);

  // Render-time reset (not an effect) whenever a different deal is opened -
  // see the identical pattern + rationale in DocumentFormDialog.
  const sessionKey = open ? (deal?.id ?? "none") : "closed";
  const [seededKey, setSeededKey] = useState(sessionKey);
  const [draft, setDraft] = useState<Draft | null>(deal ? draftFrom(deal) : null);
  const [activityType, setActivityType] = useState<DealActivityType>("note");
  const [activityText, setActivityText] = useState("");
  const [posting, setPosting] = useState(false);

  if (sessionKey !== seededKey) {
    setSeededKey(sessionKey);
    setDraft(deal ? draftFrom(deal) : null);
    setActivityType("note");
    setActivityText("");
  }

  const { data: contacts } = useContacts(workspace?.id ?? null, draft?.companyId || undefined);
  const { data: activity, loading: activityLoading } = useDealActivity(
    workspace?.id ?? null,
    deal?.id ?? null
  );
  const memberById = new Map(members.map((m) => [m.id, m]));
  const companyById = new Map(companies.map((c) => [c.id, c]));

  if (!deal || !draft) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full p-0 sm:max-w-xl lg:max-w-2xl" />
      </Sheet>
    );
  }

  async function commit(patch: Partial<Deal>) {
    if (!workspace || !deal) return;
    try {
      await updateDeal(workspace.id, deal.id, patch);
    } catch (err) {
      console.error("Deal update failed:", err);
      toast.error(err instanceof Error ? err.message : "Couldn't save. Try again.");
    }
  }

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  }

  async function handleStageClick(stage: Deal["stage"]) {
    if (!workspace || !deal || !user || stage === deal.stage) return;
    await updateDealStage(workspace.id, deal.id, deal.stage, stage, user.uid);
  }

  async function handleDelete() {
    if (!workspace || !deal) return;
    if (!window.confirm(`Delete "${deal.title}"? This can't be undone.`)) return;
    try {
      await deleteDeal(workspace.id, deal.id);
      toast.success("Deal deleted");
      onOpenChange(false);
    } catch {
      toast.error("Couldn't delete the deal. Try again.");
    }
  }

  async function handlePostActivity() {
    if (!workspace || !deal || !user || !activityText.trim()) return;
    setPosting(true);
    try {
      await addDealActivity(workspace.id, {
        dealId: deal.id,
        type: activityType,
        text: activityText.trim(),
        authorId: user.uid,
      });
      setActivityText("");
    } catch {
      toast.error("Couldn't log that. Try again.");
    } finally {
      setPosting(false);
    }
  }

  async function handleDeleteActivity(activityId: string) {
    if (!workspace) return;
    await deleteDealActivity(workspace.id, activityId).catch(() =>
      toast.error("Couldn't remove that entry.")
    );
  }

  const company = companyById.get(draft.companyId);
  const contact = draft.contactId ? contacts.find((c) => c.id === draft.contactId) : undefined;
  const owner = draft.ownerId ? memberById.get(draft.ownerId) : undefined;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-xl lg:max-w-2xl">
        {/* Header */}
        <div className="space-y-3 border-b border-border p-4 lg:p-5">
          <div className="flex items-center gap-1.5 pr-8 text-xs text-muted-foreground">
            {company && (
              <span className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full" style={{ backgroundColor: company.color }} />
                {company.name}
              </span>
            )}
            {contact && <span>· {contact.name}</span>}
          </div>

          <Input
            value={draft.title}
            onChange={(e) => set("title", e.target.value)}
            onBlur={() => commit({ title: draft.title.trim() || deal.title })}
            className="h-auto rounded-lg border border-transparent bg-transparent px-2 py-1 text-lg font-semibold shadow-none hover:bg-secondary/50 focus-visible:bg-transparent"
          />

          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-2">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-xl font-semibold tabular-nums">
                {formatCurrency(deal.value, deal.currency)}
              </span>
              {deal.probability != null && (
                <span className="text-xs text-muted-foreground">{deal.probability}% probability</span>
              )}
            </div>
            {owner && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Avatar size="sm" className="size-5">
                  {owner.photoURL && <AvatarImage src={owner.photoURL} alt={owner.displayName} />}
                  <AvatarFallback className="text-[9px]">{initials(owner.displayName)}</AvatarFallback>
                </Avatar>
                {owner.displayName}
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5 overflow-x-auto px-2 pb-0.5 scrollbar-thin">
            {DEAL_STAGES.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => handleStageClick(s.value)}
                className={cn(
                  "shrink-0 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                  s.value === deal.stage
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-transparent text-muted-foreground hover:border-white/25 hover:text-foreground"
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
          {/* Properties */}
          <div className="order-2 shrink-0 space-y-3 border-t border-border p-4 lg:w-72 lg:overflow-y-auto lg:border-t-0 lg:border-l lg:p-5">
            <SectionLabel>Deal properties</SectionLabel>

            <div className="space-y-1.5">
              <Label>Company</Label>
              <Select
                value={draft.companyId}
                onValueChange={(v) => {
                  set("companyId", v ?? draft.companyId);
                  set("contactId", "");
                  if (v) commit({ companyId: v, contactId: undefined });
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
              <Label>Contact</Label>
              <Select
                value={draft.contactId || "none"}
                onValueChange={(v) => {
                  const next = v === "none" ? "" : (v ?? "");
                  set("contactId", next);
                  commit({ contactId: next || undefined });
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>{() => contact?.name ?? "No contact"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No contact</SelectItem>
                  {contacts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {contact && (
                <div className="space-y-0.5 rounded-lg bg-secondary/50 px-2.5 py-2 text-xs text-muted-foreground">
                  {contact.title && <p>{contact.title}</p>}
                  {contact.email && <p className="truncate">{contact.email}</p>}
                  {contact.phone && <p>{contact.phone}</p>}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>Amount</Label>
                <Input
                  type="number"
                  min={0}
                  value={draft.value}
                  onChange={(e) => set("value", e.target.value)}
                  onBlur={() => commit({ value: Number(draft.value) || 0 })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Currency</Label>
                <Input
                  maxLength={3}
                  className="uppercase"
                  value={draft.currency}
                  onChange={(e) => set("currency", e.target.value.toUpperCase())}
                  onBlur={() => commit({ currency: draft.currency || deal.currency })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Probability %</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={draft.probability}
                onChange={(e) => set("probability", e.target.value)}
                onBlur={() =>
                  commit({
                    probability: draft.probability === "" ? undefined : Number(draft.probability),
                  })
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label>Close date</Label>
              <DatePicker
                value={draft.expectedCloseDate}
                onChange={(v) => {
                  set("expectedCloseDate", v);
                  commit({ expectedCloseDate: fromDateInput(v) });
                }}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Deal owner</Label>
              <Select
                value={draft.ownerId || "none"}
                onValueChange={(v) => {
                  const next = v === "none" ? "" : (v ?? "");
                  set("ownerId", next);
                  commit({ ownerId: next || undefined });
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>{() => memberById.get(draft.ownerId)?.displayName ?? "Unassigned"}</SelectValue>
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

            <SectionLabel>Management rules</SectionLabel>

            <div className="space-y-1.5">
              <Label htmlFor="deal-source">Source / tag</Label>
              <Input
                id="deal-source"
                list="deal-source-suggestions"
                placeholder="e.g. Referral"
                value={draft.source}
                onChange={(e) => set("source", e.target.value)}
                onBlur={() => commit({ source: draft.source || undefined })}
              />
              <datalist id="deal-source-suggestions">
                {DEAL_SOURCES.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="deal-exit-criteria">Exit criteria</Label>
              <Textarea
                id="deal-exit-criteria"
                rows={2}
                placeholder="What has to happen to move this forward?"
                value={draft.exitCriteria}
                onChange={(e) => set("exitCriteria", e.target.value)}
                onBlur={() => commit({ exitCriteria: draft.exitCriteria || undefined })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="deal-next-step">Next step</Label>
              <Input
                id="deal-next-step"
                placeholder="e.g. Send revised proposal"
                value={draft.nextStep}
                onChange={(e) => set("nextStep", e.target.value)}
                onBlur={() => commit({ nextStep: draft.nextStep || undefined })}
              />
              <DatePicker
                value={draft.nextStepDate}
                onChange={(v) => {
                  set("nextStepDate", v);
                  commit({ nextStepDate: fromDateInput(v) });
                }}
                placeholder="When"
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
                Delete deal
              </Button>
            </div>
          </div>

          {/* Activity / notes thread */}
          <div className="order-1 flex-1 space-y-4 p-4 lg:overflow-y-auto lg:p-5">
            <div className="space-y-2 rounded-xl border border-border bg-surface/50 p-3">
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
                        : "border-border text-muted-foreground hover:border-white/25 hover:text-foreground"
                    )}
                  >
                    <t.icon className="size-3.5" />
                    {t.label}
                  </button>
                ))}
              </div>
              <Textarea
                rows={2}
                placeholder={
                  activityType === "note" ? "Add a note…" : `Log this ${activityType}…`
                }
                value={activityText}
                onChange={(e) => setActivityText(e.target.value)}
              />
              <div className="flex justify-end">
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
                activity.map((a) => {
                  const Icon = ACTIVITY_ICON[a.type] ?? MessageSquare;
                  const author = memberById.get(a.authorId);
                  const isSystem = a.type === "created" || a.type === "stage_change";
                  return (
                    <div key={a.id} className="group flex gap-2.5">
                      <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary">
                        <Icon className="size-3.5 text-muted-foreground" />
                      </span>
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">
                            {author?.displayName ?? "Someone"}
                          </span>
                          {a.type === "stage_change" ? (
                            <span>
                              moved this to{" "}
                              <span className="font-medium text-foreground">
                                {DEAL_STAGES.find((s) => s.value === a.toStage)?.label ?? a.toStage}
                              </span>
                            </span>
                          ) : a.type === "created" ? (
                            <span>created this deal</span>
                          ) : (
                            <span>logged a {a.type}</span>
                          )}
                          <span>·</span>
                          <span>{formatDateTime(a.createdAt)}</span>
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
                          onClick={() => handleDeleteActivity(a.id)}
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

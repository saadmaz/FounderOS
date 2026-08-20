"use client";

import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useDraggable } from "@dnd-kit/core";
import { ArrowRight, Info, Mail, Phone, Plus, StickyNote, Users as UsersIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/lib/auth/auth-provider";
import { updateDealStage, useLatestDealActivityByDeal } from "@/lib/data/deals";
import { formatCurrency, formatDate, formatRelativeDate, initials } from "@/lib/format";
import { DEAL_STAGES, type Contact, type Deal, type DealActivity, type DealStage, type WorkspaceMember } from "@/lib/types";
import { cn } from "@/lib/utils";

const STAGE_DOTS: Record<DealStage, string> = {
  prospecting: "bg-muted-foreground-2",
  qualification: "bg-analytics-cyan",
  meeting: "bg-analytics-purple",
  proposal: "bg-analytics-orange",
  negotiation: "bg-warning",
  closed_won: "bg-success",
  closed_lost: "bg-danger",
};

const ACTIVITY_ICON: Record<string, typeof StickyNote> = {
  note: StickyNote,
  call: Phone,
  email: Mail,
  meeting: UsersIcon,
  stage_change: ArrowRight,
  created: Plus,
};

const ACTIVITY_ICON_COLOR: Record<string, string> = {
  note: "text-analytics-orange",
  call: "text-success",
  email: "text-primary",
  meeting: "text-analytics-purple",
  stage_change: "text-muted-foreground-2",
  created: "text-muted-foreground-2",
};

/** One-line summary of a deal's most recent activity for its kanban card -
 * a stage move reads as "Moved to Qualification", a logged touchpoint
 * shows its note text (or a generic label if it has none). */
function activitySummary(a: DealActivity): string {
  if (a.type === "stage_change") {
    return `Moved to ${DEAL_STAGES.find((s) => s.value === a.toStage)?.label ?? a.toStage}`;
  }
  if (a.type === "created") return "Deal created";
  return a.text || `Logged a ${a.type}`;
}

function DealCard({
  deal,
  contact,
  owner,
  lastActivity,
  onClick,
}: {
  deal: Deal;
  contact?: Contact;
  owner?: WorkspaceMember;
  lastActivity?: DealActivity;
  onClick?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: deal.id,
  });
  const isClosed = deal.stage === "closed_won" || deal.stage === "closed_lost";
  const ActivityIcon = lastActivity ? (ACTIVITY_ICON[lastActivity.type] ?? StickyNote) : null;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onClick}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn(
        "cursor-grab space-y-2.5 rounded-xl border border-border bg-card p-3.5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-white/10 hover:shadow-md active:cursor-grabbing",
        isDragging && "opacity-40",
        isClosed && "opacity-80"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="line-clamp-2 text-sm font-medium leading-snug">{deal.title}</p>
        {deal.probability != null && (
          <span className="shrink-0 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground tabular-nums">
            {deal.probability}%
          </span>
        )}
      </div>

      <p className="text-base font-semibold tracking-tight tabular-nums">
        {formatCurrency(deal.value, deal.currency)}
      </p>

      {(contact || deal.source) && (
        <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <span className="truncate">{contact?.name ?? "No contact"}</span>
          {deal.source && (
            <span className="shrink-0 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground-2">
              {deal.source}
            </span>
          )}
        </div>
      )}

      {deal.nextStep && (
        <p className="flex items-center gap-1 truncate text-[11px] text-muted-foreground-2">
          <ArrowRight className="size-3 shrink-0" />
          <span className="truncate">{deal.nextStep}</span>
        </p>
      )}

      {lastActivity && ActivityIcon && (
        <div className="flex items-center gap-1.5 border-t border-border pt-2 text-[11px] text-muted-foreground-2">
          <ActivityIcon
            className={cn("size-3 shrink-0", ACTIVITY_ICON_COLOR[lastActivity.type] ?? "text-muted-foreground-2")}
          />
          <span className="min-w-0 flex-1 truncate">{activitySummary(lastActivity)}</span>
          <span className="shrink-0">
            {formatRelativeDate(lastActivity.date ?? lastActivity.createdAt)}
          </span>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 pt-0.5">
        <Avatar size="sm" className="size-5">
          {owner?.photoURL && <AvatarImage src={owner.photoURL} alt={owner.displayName} />}
          <AvatarFallback className="text-[9px]">
            {owner ? initials(owner.displayName) : "—"}
          </AvatarFallback>
        </Avatar>
        {deal.expectedCloseDate && (
          <span className="shrink-0 text-[11px] text-muted-foreground-2">
            {formatDate(deal.expectedCloseDate)}
          </span>
        )}
      </div>
    </div>
  );
}

function Column({
  stage,
  label,
  description,
  dot,
  deals,
  contactById,
  memberById,
  lastActivityByDeal,
  onCardClick,
}: {
  stage: DealStage;
  label: string;
  description: string;
  dot: string;
  deals: Deal[];
  contactById: Map<string, Contact>;
  memberById: Map<string, WorkspaceMember>;
  lastActivityByDeal: Map<string, DealActivity>;
  onCardClick: (deal: Deal) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const total = deals.reduce((sum, d) => sum + d.value, 0);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-72 shrink-0 flex-col rounded-xl border border-border bg-surface/50 transition-colors",
        isOver && "border-primary/40 bg-primary/5"
      )}
    >
      <div className="flex items-center gap-1.5 border-b border-border px-3 py-2.5">
        <span className={cn("size-2 shrink-0 rounded-full", dot)} />
        <span className="text-xs font-semibold">{label}</span>
        <Tooltip>
          <TooltipTrigger className="text-muted-foreground-2 hover:text-foreground">
            <Info className="size-3" />
          </TooltipTrigger>
          <TooltipContent>{description}</TooltipContent>
        </Tooltip>
        <span className="ml-auto text-xs text-muted-foreground-2">{deals.length}</span>
      </div>
      {deals.length > 0 && (
        <div className="border-b border-border px-3 py-1.5 text-[11px] font-medium text-muted-foreground tabular-nums">
          {formatCurrency(total, deals[0]?.currency ?? "LKR")}
        </div>
      )}
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2 scrollbar-thin">
        {deals.map((d) => (
          <DealCard
            key={d.id}
            deal={d}
            contact={d.contactId ? contactById.get(d.contactId) : undefined}
            owner={d.ownerId ? memberById.get(d.ownerId) : undefined}
            lastActivity={lastActivityByDeal.get(d.id)}
            onClick={() => onCardClick(d)}
          />
        ))}
      </div>
    </div>
  );
}

export function DealBoard({
  deals,
  contacts,
  members,
  workspaceId,
  onCardClick,
}: {
  deals: Deal[];
  contacts: Contact[];
  members: WorkspaceMember[];
  workspaceId: string;
  onCardClick: (deal: Deal) => void;
}) {
  const { user } = useAuth();
  const [activeId, setActiveId] = useState<string | null>(null);
  const contactById = useMemo(() => new Map(contacts.map((c) => [c.id, c])), [contacts]);
  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const lastActivityByDeal = useLatestDealActivityByDeal(workspaceId);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function handleDragStart(e: DragStartEvent) {
    setActiveId(e.active.id as string);
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over || !user) return;
    const deal = deals.find((d) => d.id === active.id);
    const newStage = over.id as DealStage;
    if (deal && deal.stage !== newStage) {
      updateDealStage(workspaceId, deal.id, deal.stage, newStage, user.uid);
    }
  }

  const activeDeal = deals.find((d) => d.id === activeId);

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex flex-1 gap-4 overflow-x-auto p-4 lg:p-6 scrollbar-thin">
        {DEAL_STAGES.map((col) => (
          <Column
            key={col.value}
            stage={col.value}
            label={col.label}
            description={col.description}
            dot={STAGE_DOTS[col.value]}
            deals={deals.filter((d) => d.stage === col.value)}
            contactById={contactById}
            memberById={memberById}
            lastActivityByDeal={lastActivityByDeal}
            onCardClick={onCardClick}
          />
        ))}
      </div>
      <DragOverlay>
        {activeDeal ? (
          <DealCard
            deal={activeDeal}
            contact={activeDeal.contactId ? contactById.get(activeDeal.contactId) : undefined}
            owner={activeDeal.ownerId ? memberById.get(activeDeal.ownerId) : undefined}
            lastActivity={lastActivityByDeal.get(activeDeal.id)}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

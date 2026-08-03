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
import { useMemo, useState } from "react";
import { updateDealStage } from "@/lib/data/deals";
import { formatCurrency, formatDate } from "@/lib/format";
import { DEAL_STAGES, type Contact, type Deal, type DealStage } from "@/lib/types";
import { cn } from "@/lib/utils";

const STAGE_DOTS: Record<DealStage, string> = {
  lead: "bg-muted-foreground-2",
  qualified: "bg-primary",
  proposal: "bg-analytics-purple",
  negotiation: "bg-warning",
  won: "bg-success",
  lost: "bg-danger",
};

function DealCard({
  deal,
  contact,
  onClick,
}: {
  deal: Deal;
  contact?: Contact;
  onClick?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: deal.id,
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onClick}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn(
        "cursor-grab space-y-2 rounded-lg border border-border bg-card p-3 active:cursor-grabbing",
        isDragging && "opacity-40"
      )}
    >
      <p className="text-sm font-medium leading-snug">{deal.title}</p>
      <p className="text-sm font-semibold">{formatCurrency(deal.value, deal.currency)}</p>
      <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span className="truncate">{contact?.name ?? "No contact"}</span>
        {deal.expectedCloseDate && (
          <span className="shrink-0 text-muted-foreground-2">{formatDate(deal.expectedCloseDate)}</span>
        )}
      </div>
    </div>
  );
}

function Column({
  stage,
  label,
  dot,
  deals,
  contactById,
  onCardClick,
}: {
  stage: DealStage;
  label: string;
  dot: string;
  deals: Deal[];
  contactById: Map<string, Contact>;
  onCardClick: (deal: Deal) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-72 shrink-0 flex-col rounded-xl border border-border bg-surface/50 transition-colors",
        isOver && "border-primary/40 bg-primary/5"
      )}
    >
      <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
        <span className={cn("size-2 rounded-full", dot)} />
        <span className="text-xs font-semibold">{label}</span>
        <span className="ml-auto text-xs text-muted-foreground-2">{deals.length}</span>
      </div>
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2 scrollbar-thin">
        {deals.map((d) => (
          <DealCard
            key={d.id}
            deal={d}
            contact={d.contactId ? contactById.get(d.contactId) : undefined}
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
  workspaceId,
  onCardClick,
}: {
  deals: Deal[];
  contacts: Contact[];
  workspaceId: string;
  onCardClick: (deal: Deal) => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const contactById = useMemo(() => new Map(contacts.map((c) => [c.id, c])), [contacts]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function handleDragStart(e: DragStartEvent) {
    setActiveId(e.active.id as string);
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const deal = deals.find((d) => d.id === active.id);
    const newStage = over.id as DealStage;
    if (deal && deal.stage !== newStage) {
      updateDealStage(workspaceId, deal.id, newStage);
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
            dot={STAGE_DOTS[col.value]}
            deals={deals.filter((d) => d.stage === col.value)}
            contactById={contactById}
            onCardClick={onCardClick}
          />
        ))}
      </div>
      <DragOverlay>
        {activeDeal ? (
          <DealCard
            deal={activeDeal}
            contact={activeDeal.contactId ? contactById.get(activeDeal.contactId) : undefined}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

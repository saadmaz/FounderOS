"use client";

import { addDoc, collection, doc, orderBy, updateDoc, where, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { normalizeDealStage, type Deal, type DealActivity, type DealActivityType, type DealStage } from "@/lib/types";
import { now, omitUndefined, withFieldDeletes } from "./firestore-helpers";
import { useCollection } from "./use-collection";

const path = (workspaceId: string) => `workspaces/${workspaceId}/deals`;
const activityPath = (workspaceId: string) => `workspaces/${workspaceId}/dealActivity`;

export function useDeals(workspaceId: string | null, companyId?: string) {
  const constraints = companyId
    ? [where("companyId", "==", companyId), orderBy("createdAt", "desc")]
    : [orderBy("createdAt", "desc")];
  const result = useCollection<Deal>(workspaceId ? path(workspaceId) : null, constraints, [
    workspaceId,
    companyId,
  ]);
  // Normalize on the way out so deals written under the old 6-stage
  // pipeline still land in a real column instead of falling through every
  // DEAL_STAGES filter - see normalizeDealStage's doc comment.
  return { ...result, data: result.data.map((d) => ({ ...d, stage: normalizeDealStage(d.stage) })) };
}

/** Direct contactId query rather than piggybacking on useDeals(companyId)
 * + a client-side filter - a deal stays visible on its contact even if
 * that contact's company field is later changed. */
export function useDealsByContact(workspaceId: string | null, contactId: string | null) {
  const result = useCollection<Deal>(
    workspaceId && contactId ? path(workspaceId) : null,
    [where("contactId", "==", contactId), orderBy("createdAt", "desc")],
    [workspaceId, contactId]
  );
  return { ...result, data: result.data.map((d) => ({ ...d, stage: normalizeDealStage(d.stage) })) };
}

export async function createDeal(
  workspaceId: string,
  input: Pick<Deal, "companyId" | "title" | "value" | "currency" | "stage"> & Partial<Deal>,
  actorId: string
) {
  const ts = now();
  const ref = await addDoc(collection(db, path(workspaceId)), {
    ...input,
    workspaceId,
    createdAt: ts,
    updatedAt: ts,
  });
  await addDealActivity(workspaceId, { dealId: ref.id, type: "created", authorId: actorId });
  return ref;
}

export async function updateDeal(workspaceId: string, dealId: string, patch: Partial<Deal>) {
  return updateDoc(doc(db, path(workspaceId), dealId), {
    ...withFieldDeletes(patch),
    updatedAt: now(),
  });
}

/** Moves a deal to a new stage and logs the transition as a milestone in
 * its activity timeline - `fromStage` is whatever the caller already has
 * in hand (the board/sheet always has the current deal loaded), avoiding
 * an extra read just to know what the old value was. */
export async function updateDealStage(
  workspaceId: string,
  dealId: string,
  fromStage: DealStage,
  toStage: DealStage,
  actorId: string
) {
  if (fromStage === toStage) return;
  await updateDeal(workspaceId, dealId, { stage: toStage });
  await addDealActivity(workspaceId, { dealId, type: "stage_change", fromStage, toStage, authorId: actorId });
}

export async function deleteDeal(workspaceId: string, dealId: string) {
  return deleteDoc(doc(db, path(workspaceId), dealId));
}

// ===================== Activity / notes thread =====================

/** Sorted by `date` (when it actually happened, for backdated entries)
 * falling back to `createdAt` - client-side, like useCompanyNotes, so a
 * backdated entry lands in its real chronological slot instead of always
 * at the top. */
export function useDealActivity(workspaceId: string | null, dealId: string | null) {
  const result = useCollection<DealActivity>(
    workspaceId && dealId ? activityPath(workspaceId) : null,
    [where("dealId", "==", dealId), orderBy("createdAt", "desc")],
    [workspaceId, dealId]
  );
  return {
    ...result,
    data: [...result.data].sort((a, b) => (b.date ?? b.createdAt) - (a.date ?? a.createdAt)),
  };
}

export async function addDealActivity(
  workspaceId: string,
  input: {
    dealId: string;
    type: DealActivityType;
    text?: string;
    date?: number;
    fromStage?: DealStage;
    toStage?: DealStage;
    authorId: string;
  }
) {
  return addDoc(collection(db, activityPath(workspaceId)), {
    ...omitUndefined(input),
    workspaceId,
    createdAt: now(),
  });
}

export async function deleteDealActivity(workspaceId: string, activityId: string) {
  return deleteDoc(doc(db, activityPath(workspaceId), activityId));
}

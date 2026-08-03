"use client";

import { addDoc, collection, doc, orderBy, updateDoc, where, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { Meeting, MeetingStatus } from "@/lib/types";
import { now } from "./firestore-helpers";
import { useCollection } from "./use-collection";

const path = (workspaceId: string) => `workspaces/${workspaceId}/meetings`;

export function useMeetings(workspaceId: string | null, companyId?: string) {
  const constraints = companyId
    ? [where("companyId", "==", companyId), orderBy("scheduledAt", "desc")]
    : [orderBy("scheduledAt", "desc")];
  return useCollection<Meeting>(workspaceId ? path(workspaceId) : null, constraints, [
    workspaceId,
    companyId,
  ]);
}

export async function createMeeting(
  workspaceId: string,
  input: Pick<
    Meeting,
    "companyId" | "title" | "scheduledAt" | "durationMinutes" | "attendeeIds" | "status"
  > &
    Partial<Meeting>
) {
  const ts = now();
  return addDoc(collection(db, path(workspaceId)), {
    ...input,
    workspaceId,
    createdAt: ts,
    updatedAt: ts,
  });
}

export async function updateMeeting(
  workspaceId: string,
  meetingId: string,
  patch: Partial<Meeting>
) {
  return updateDoc(doc(db, path(workspaceId), meetingId), {
    ...patch,
    updatedAt: now(),
  });
}

export async function setMeetingStatus(
  workspaceId: string,
  meetingId: string,
  status: MeetingStatus
) {
  return updateMeeting(workspaceId, meetingId, { status });
}

export async function deleteMeeting(workspaceId: string, meetingId: string) {
  return deleteDoc(doc(db, path(workspaceId), meetingId));
}

"use client";

import { addDoc, collection, deleteDoc, doc, getDoc, orderBy, where } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { Invite, Role, Workspace } from "@/lib/types";
import { now } from "./firestore-helpers";
import { useCollection } from "./use-collection";

const path = "invites";
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function useInvites(workspaceId: string | null) {
  return useCollection<Invite>(
    workspaceId ? path : null,
    [
      where("workspaceId", "==", workspaceId),
      where("status", "==", "pending"),
      orderBy("createdAt", "desc"),
    ],
    [workspaceId]
  );
}

export async function createInvite(
  workspace: Pick<Workspace, "id" | "name">,
  input: { email: string; role: Exclude<Role, "owner"> },
  invitedBy: { uid: string; displayName: string }
) {
  const ts = now();
  const ref = await addDoc(collection(db, path), {
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    email: input.email.trim().toLowerCase(),
    role: input.role,
    invitedBy: invitedBy.uid,
    invitedByName: invitedBy.displayName,
    status: "pending",
    createdAt: ts,
    expiresAt: ts + SEVEN_DAYS_MS,
  });
  return ref.id;
}

export async function revokeInvite(inviteId: string) {
  return deleteDoc(doc(db, path, inviteId));
}

export async function getInvite(inviteId: string): Promise<Invite | null> {
  const snap = await getDoc(doc(db, path, inviteId));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Invite) : null;
}

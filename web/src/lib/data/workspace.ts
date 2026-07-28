"use client";

import type { User } from "firebase/auth";
import { collection, doc, getDoc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { Workspace, WorkspaceMember } from "@/lib/types";
import { now } from "./firestore-helpers";

/**
 * Every user needs exactly one workspace to land in. This finds their
 * existing one via the userWorkspaces pointer doc, or bootstraps a brand
 * new workspace + owner membership on first sign-in.
 */
export async function ensureWorkspaceForUser(user: User): Promise<string> {
  const pointerRef = doc(db, "userWorkspaces", user.uid);
  const pointerSnap = await getDoc(pointerRef);
  if (pointerSnap.exists()) {
    return pointerSnap.data().primaryWorkspaceId as string;
  }

  const workspaceRef = doc(collection(db, "workspaces"));
  const memberRef = doc(db, "workspaces", workspaceRef.id, "members", user.uid);
  const ts = now();

  const name = user.displayName ? `${user.displayName.split(" ")[0]}'s Workspace` : "My Workspace";
  const workspace: Omit<Workspace, "id"> = {
    name,
    slug: workspaceRef.id,
    createdAt: ts,
    createdBy: user.uid,
  };
  const member: Omit<WorkspaceMember, "id"> = {
    workspaceId: workspaceRef.id,
    email: user.email ?? "",
    displayName: user.displayName ?? user.email ?? "Founder",
    photoURL: user.photoURL ?? undefined,
    role: "owner",
    createdAt: ts,
  };

  const batch = writeBatch(db);
  batch.set(workspaceRef, workspace);
  batch.set(memberRef, member);
  batch.set(pointerRef, { primaryWorkspaceId: workspaceRef.id });
  await batch.commit();

  return workspaceRef.id;
}

export async function getWorkspace(workspaceId: string): Promise<Workspace | null> {
  const snap = await getDoc(doc(db, "workspaces", workspaceId));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Workspace) : null;
}

export async function getMember(
  workspaceId: string,
  uid: string
): Promise<WorkspaceMember | null> {
  const snap = await getDoc(doc(db, "workspaces", workspaceId, "members", uid));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as WorkspaceMember) : null;
}

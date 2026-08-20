"use client";

import { deleteDoc, doc, orderBy, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { Role, WorkspaceMember } from "@/lib/types";
import { useCollection } from "./use-collection";

const path = (workspaceId: string) => `workspaces/${workspaceId}/members`;

export function useMembers(workspaceId: string | null) {
  return useCollection<WorkspaceMember>(
    workspaceId ? path(workspaceId) : null,
    [orderBy("createdAt", "asc")],
    [workspaceId]
  );
}

/** Firestore rules refuse this if `memberId`'s current or new role is
 * "owner" - no demotion, removal, or reassignment of the owner role through
 * member management. */
export async function updateMemberRole(workspaceId: string, memberId: string, role: Exclude<Role, "owner">) {
  return updateDoc(doc(db, path(workspaceId), memberId), { role });
}

export async function removeMember(workspaceId: string, memberId: string) {
  return deleteDoc(doc(db, path(workspaceId), memberId));
}

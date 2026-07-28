"use client";

import { orderBy } from "firebase/firestore";
import type { WorkspaceMember } from "@/lib/types";
import { useCollection } from "./use-collection";

const path = (workspaceId: string) => `workspaces/${workspaceId}/members`;

export function useMembers(workspaceId: string | null) {
  return useCollection<WorkspaceMember>(
    workspaceId ? path(workspaceId) : null,
    [orderBy("createdAt", "asc")],
    [workspaceId]
  );
}

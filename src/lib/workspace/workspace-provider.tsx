"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/auth-provider";
import { ensureWorkspaceForUser, getMember, getWorkspace } from "@/lib/data/workspace";
import type { Role, Workspace } from "@/lib/types";

interface WorkspaceContextValue {
  workspace: Workspace | null;
  role: Role | null;
  loading: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextValue>({
  workspace: null,
  role: null,
  loading: true,
});

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;
    // Reset to loading when the user changes (e.g. re-auth) - initial
    // mount is already `true` from useState's default above.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    (async () => {
      try {
        const workspaceId = await ensureWorkspaceForUser(user);
        const [ws, member] = await Promise.all([
          getWorkspace(workspaceId),
          getMember(workspaceId, user.uid),
        ]);
        if (cancelled) return;
        setWorkspace(ws);
        setRole(member?.role ?? null);
      } catch (err) {
        console.error("Failed to load workspace", err);
        if (!cancelled) {
          setWorkspace(null);
          setRole(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  // No signed-in user: nothing to load, and any previously loaded
  // workspace from a prior session no longer applies.
  const value = !authLoading && !user ? { workspace: null, role: null, loading: false } : { workspace, role, loading: authLoading || loading };

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  return useContext(WorkspaceContext);
}

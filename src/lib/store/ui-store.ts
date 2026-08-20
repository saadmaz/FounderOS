"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UIStore {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  selectedCompanyId: string | "all";
  setSelectedCompanyId: (id: string | "all") => void;
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
  // WorkspaceProvider is mounted globally (see src/app/providers.tsx), so its
  // bootstrap effect (ensureWorkspaceForUser) fires the instant a brand-new
  // user signs up on ANY page - including mid-invite-acceptance, racing to
  // auto-create them a separate personal workspace before the invite page's
  // own accept call can point them at the invited one. The invite page holds
  // this lock for the duration of signup+accept so that race can't happen;
  // WorkspaceProvider simply skips bootstrapping while it's held.
  workspaceBootstrapLocked: boolean;
  setWorkspaceBootstrapLocked: (locked: boolean) => void;
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      selectedCompanyId: "all",
      setSelectedCompanyId: (id) => set({ selectedCompanyId: id }),
      commandPaletteOpen: false,
      setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
      workspaceBootstrapLocked: false,
      setWorkspaceBootstrapLocked: (locked) => set({ workspaceBootstrapLocked: locked }),
    }),
    {
      name: "founderos-ui-store",
      partialize: (s) => ({ sidebarCollapsed: s.sidebarCollapsed }),
    }
  )
);

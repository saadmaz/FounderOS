"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CommandPalette } from "@/components/layout/command-palette";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { useAuth } from "@/lib/auth/auth-provider";
import { useWorkspace } from "@/lib/workspace/workspace-provider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { loading: workspaceLoading } = useWorkspace();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [authLoading, user, router]);

  // Bail out before the chrome below: signed-out visitors get redirected by
  // the effect above and should see nothing of the app in the meantime, and
  // there's no `user` yet for Topbar to render an avatar for.
  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <MobileNav open={mobileNavOpen} onOpenChange={setMobileNavOpen} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenMobileNav={() => setMobileNavOpen(true)} />
        <main className="flex flex-1 flex-col overflow-y-auto scrollbar-thin">
          {/* Sidebar/topbar mount immediately above - only the page content
           * waits on the workspace, so opening the app doesn't look like
           * the whole screen popping in from a blank spinner. */}
          {workspaceLoading ? (
            <div className="flex flex-1 items-center justify-center">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            children
          )}
        </main>
      </div>
      <CommandPalette />
    </div>
  );
}

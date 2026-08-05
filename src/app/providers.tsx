"use client";

import { ThemeProvider } from "next-themes";
import { PageViewTracker } from "@/components/layout/page-view-tracker";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth/auth-provider";
import { WorkspaceProvider } from "@/lib/workspace/workspace-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
      <TooltipProvider delay={200}>
        <AuthProvider>
          <WorkspaceProvider>
            <PageViewTracker />
            {children}
            <Toaster position="bottom-right" />
          </WorkspaceProvider>
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}

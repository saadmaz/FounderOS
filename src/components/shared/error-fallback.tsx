"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { analytics } from "@/lib/firebase/client";

/**
 * Shared UI for every error.tsx boundary in the app (see src/app/error.tsx
 * and src/app/(app)/error.tsx) - Next.js requires each boundary to be its
 * own file, but they can all render the same fallback.
 */
export function ErrorFallback({
  error,
  reset,
  fullPage = false,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  /** Full-page takeover for layout-level crashes (no sidebar/topbar left to
   * anchor to) vs. a contained box for page-level crashes. */
  fullPage?: boolean;
}) {
  useEffect(() => {
    console.error("Caught by error boundary:", error);
    // Best-effort - fires the GA4-standard "exception" event so crashes show
    // up in Firebase/GA4 analytics without any extra dashboard setup.
    import("firebase/analytics")
      .then(({ logEvent }) => {
        if (analytics) logEvent(analytics, "exception", { description: error.message, fatal: true });
      })
      .catch(() => {});
  }, [error]);

  return (
    <div
      className={
        fullPage
          ? "flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center"
          : "flex flex-1 flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border p-12 text-center"
      }
    >
      <div className="flex size-12 items-center justify-center rounded-full bg-danger/10">
        <AlertTriangle className="size-5 text-danger" />
      </div>
      <div>
        <h3 className="text-sm font-semibold">Something went wrong</h3>
        <p className="mt-1 max-w-xs text-sm text-muted-foreground">
          This part of the app hit an unexpected error. You can try again, or head back to the
          dashboard.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={() => (window.location.href = "/dashboard")}>
          Go to dashboard
        </Button>
        <Button onClick={reset}>Try again</Button>
      </div>
    </div>
  );
}

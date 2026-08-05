"use client";

import { ErrorFallback } from "@/components/shared/error-fallback";

/**
 * Page-level error boundary for everything under (app) - a crash in, say,
 * the Companies page only takes out the main content area; Sidebar/Topbar
 * (rendered by (app)/layout.tsx, outside this boundary) stay usable so you
 * can navigate away. Layout-level crashes fall through to the root
 * src/app/error.tsx instead.
 */
export default function AppErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorFallback error={error} reset={reset} />;
}

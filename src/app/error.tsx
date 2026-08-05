"use client";

import { ErrorFallback } from "@/components/shared/error-fallback";

/**
 * Root-level error boundary - catches anything thrown while rendering
 * (app)/layout.tsx (Sidebar, Topbar, CommandPalette) or the /login page,
 * i.e. exactly the class of bug that used to blank the whole app (see the
 * topbar DropdownMenuGroup crash). Full-page fallback since the shell
 * itself may be what crashed.
 */
export default function GlobalErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorFallback error={error} reset={reset} fullPage />;
}

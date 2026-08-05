"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics";

/**
 * GA4 only auto-collects a "page_view" on the very first hard load - client
 * -side route changes (which is all of them, in this SPA) need a manual
 * event per navigation, or Analytics only ever sees the first page anyone
 * lands on. Mounted once in Providers so every route change anywhere in the
 * app is covered without touching individual pages.
 */
export function PageViewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    trackEvent("page_view", { page_path: pathname });
  }, [pathname]);

  return null;
}

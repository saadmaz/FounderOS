"use client";

import { analyticsReady } from "@/lib/firebase/client";

/**
 * Fire-and-forget wrapper around Firebase Analytics (GA4). Awaits
 * analyticsReady rather than checking a plain nullable value - events fired
 * early (e.g. sign_up on the very first page load) would otherwise race the
 * async support-detection in client.ts and get silently dropped. Events
 * show up in Firebase Console > Analytics > Events, or the linked GA4
 * property for richer per-user reports.
 */
export async function trackEvent(name: string, params?: Record<string, unknown>) {
  const instance = await analyticsReady;
  if (!instance) return;
  const { logEvent } = await import("firebase/analytics");
  logEvent(instance, name, params);
}

/** Ties subsequent events to a Firebase Auth uid so Analytics/GA4 can break
 * results down per user, not just in aggregate. Call with `null` on sign-out. */
export async function identifyUser(uid: string | null) {
  const instance = await analyticsReady;
  if (!instance) return;
  const { setUserId } = await import("firebase/analytics");
  setUserId(instance, uid);
}

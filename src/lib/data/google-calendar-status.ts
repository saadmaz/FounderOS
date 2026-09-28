"use client";

import { useCallback, useEffect, useState } from "react";
import { auth } from "@/lib/firebase/client";

export interface GoogleCalendarStatus {
  connected: boolean;
  googleEmail?: string;
  status?: "connected" | "error";
  lastError?: string | null;
  lastSyncedAt?: number | null;
}

async function authedFetch(path: string, init?: RequestInit) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in");
  const idToken = await user.getIdToken();
  const res = await fetch(path, {
    ...init,
    headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${idToken}` },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error ?? `Request failed (${res.status})`);
  return body;
}

/** Polls the caller's own Google Calendar connection status - can't be a
 * normal Firestore hook since the connection doc is Admin-SDK-only (never
 * readable from the client SDK), so it goes through
 * /api/integrations/google-calendar/status instead. */
export function useGoogleCalendarStatus() {
  const [status, setStatus] = useState<GoogleCalendarStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!auth.currentUser) {
      setStatus(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const body = await authedFetch("/api/integrations/google-calendar/status");
      setStatus(body as GoogleCalendarStatus);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(() => {
      refresh();
    });
    return unsubscribe;
  }, [refresh]);

  return { status, loading, refresh };
}

export async function connectGoogleCalendar(workspaceId: string): Promise<void> {
  const body = await authedFetch("/api/integrations/google-calendar/connect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workspaceId }),
  });
  window.location.href = body.url;
}

export async function disconnectGoogleCalendar(): Promise<void> {
  await authedFetch("/api/integrations/google-calendar/disconnect", { method: "POST" });
}

export async function syncGoogleCalendarNow(): Promise<void> {
  await authedFetch("/api/integrations/google-calendar/sync-now", { method: "POST" });
}

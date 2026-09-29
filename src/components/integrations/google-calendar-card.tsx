"use client";

import { CalendarSync, Check, Loader2, RefreshCw, Unlink } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/lib/confirm/confirm-provider";
import {
  connectGoogleCalendar,
  disconnectGoogleCalendar,
  syncGoogleCalendarNow,
  useGoogleCalendarStatus,
} from "@/lib/data/google-calendar-status";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/lib/workspace/workspace-provider";

const RESULT_MESSAGES: Record<string, { type: "success" | "error"; message: string }> = {
  connected: { type: "success", message: "Google Calendar connected" },
  denied: { type: "error", message: "Google Calendar connection was cancelled" },
  error: { type: "error", message: "Couldn't connect Google Calendar. Try again." },
};

export function GoogleCalendarCard() {
  const { workspace } = useWorkspace();
  const { status, loading, refresh } = useGoogleCalendarStatus();
  const confirm = useConfirm();
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Reads `?googleCalendar=...` directly off the URL (rather than
  // next/navigation's useSearchParams) so this doesn't need a Suspense
  // boundary just to show a one-time toast after the OAuth redirect back
  // from src/app/api/integrations/google-calendar/callback.
  useEffect(() => {
    const result = new URLSearchParams(window.location.search).get("googleCalendar");
    if (!result) return;
    const info = RESULT_MESSAGES[result];
    if (info) (info.type === "success" ? toast.success : toast.error)(info.message);
    window.history.replaceState(null, "", "/profile");
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleConnect() {
    if (!workspace) return;
    setConnecting(true);
    try {
      await connectGoogleCalendar(workspace.id);
      // Navigates away to Google's consent screen on success - no need to
      // reset `connecting` here.
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't start the connect flow");
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    const ok = await confirm(
      "Disconnect Google Calendar? Already-synced events stay in both places, but stop updating each other."
    );
    if (!ok) return;
    setDisconnecting(true);
    try {
      await disconnectGoogleCalendar();
      toast.success("Google Calendar disconnected");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't disconnect");
    } finally {
      setDisconnecting(false);
    }
  }

  async function handleSyncNow() {
    setSyncing(true);
    try {
      // The request itself returns almost immediately - the actual pull/
      // push work runs server-side in the background (see the route's
      // docstring for why: awaiting a real Google account's calendar/task
      // history here was slow and variable enough to 504 on this fetch).
      // So there's nothing to await here worth showing as "done" - just
      // poll the status a couple of times over the next several seconds so
      // the card catches up without the user needing to reload.
      await syncGoogleCalendarNow();
      toast.success("Sync started");
      await new Promise((resolve) => setTimeout(resolve, 3000));
      await refresh();
      await new Promise((resolve) => setTimeout(resolve, 5000));
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-inset ring-ring-subtle">
          <CalendarSync className="size-4.5 text-primary" />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">Google Calendar</h2>
          <p className="text-xs text-muted-foreground">
            Two-way sync with your primary Google Calendar (every event on it - including
            existing history - becomes visible to everyone in this workspace), plus your
            FounderOS tasks two-way with a dedicated &quot;FounderOS&quot; list in Google Tasks
            (editing or completing a task there updates it here - a task added directly in
            Google Tasks won&apos;t appear here, since it has no company or priority to assign).
          </p>
        </div>
      </div>

      <div className="mt-4">
        {loading ? (
          <div className="h-9 w-44 animate-pulse rounded-md bg-muted" />
        ) : status?.connected ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {status.status === "error" ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-danger/10 px-2 py-0.5 text-xs font-medium text-danger">
                  Sync error
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                  <Check className="size-3" /> Connected
                </span>
              )}
              <span className="truncate text-muted-foreground">{status.googleEmail}</span>
            </div>
            {status.lastError && status.status === "error" && (
              <p className="text-xs text-danger">{status.lastError}</p>
            )}
            <p className="text-xs text-muted-foreground">
              {status.lastSyncedAt ? `Last synced ${formatDateTime(status.lastSyncedAt)}` : "Not synced yet"}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={handleSyncNow} disabled={syncing} className="gap-1.5">
                <RefreshCw className={cn("size-3.5", syncing && "animate-spin")} />
                Sync now
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="gap-1.5 text-danger hover:text-danger"
              >
                <Unlink className="size-3.5" />
                Disconnect
              </Button>
            </div>
          </div>
        ) : (
          <Button onClick={handleConnect} disabled={connecting || !workspace} className="gap-1.5">
            {connecting ? <Loader2 className="size-4 animate-spin" /> : <CalendarSync className="size-4" />}
            Connect Google Calendar
          </Button>
        )}
      </div>
    </section>
  );
}

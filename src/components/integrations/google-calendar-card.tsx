"use client";

import { CalendarSync, Check, Loader2, RefreshCw, Unlink } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SettingsSection } from "@/components/shared/settings-section";
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
    <SettingsSection
      icon={CalendarSync}
      title="Google Calendar"
      description="Two-way sync with your primary Google Calendar and Google Tasks."
      action={
        !loading && status?.connected ? (
          status.status === "error" ? (
            <span className="inline-flex items-center rounded-full bg-danger/10 px-2.5 py-0.5 text-xs font-medium text-danger">
              Sync error
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success">
              <Check className="size-3" /> Connected
            </span>
          )
        ) : null
      }
      bodyClassName="space-y-4"
      footer={
        loading ? (
          <div className="h-8 w-40 animate-pulse rounded-md bg-muted" />
        ) : status?.connected ? (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="mr-auto gap-1.5 text-danger hover:text-danger"
            >
              <Unlink className="size-3.5" />
              Disconnect
            </Button>
            <Button variant="outline" size="sm" onClick={handleSyncNow} disabled={syncing} className="gap-1.5">
              <RefreshCw className={cn("size-3.5", syncing && "animate-spin")} />
              Sync now
            </Button>
          </>
        ) : (
          <Button onClick={handleConnect} disabled={connecting || !workspace} className="gap-1.5">
            {connecting ? <Loader2 className="size-4 animate-spin" /> : <CalendarSync className="size-4" />}
            Connect Google Calendar
          </Button>
        )
      }
    >
      {status?.connected && !loading && (
        <dl className="space-y-3 text-sm">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-muted-foreground">Account</dt>
            <dd className="truncate font-medium">{status.googleEmail}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-muted-foreground">Last synced</dt>
            <dd className="font-medium">
              {status.lastSyncedAt ? formatDateTime(status.lastSyncedAt) : "Not synced yet"}
            </dd>
          </div>
          {status.lastError && status.status === "error" && (
            <p className="rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">{status.lastError}</p>
          )}
        </dl>
      )}
      <ul className="space-y-1.5 text-[13px] leading-5 text-muted-foreground">
        <li>
          Events from the last 90 days onward, including future ones, become visible to everyone in
          this workspace.
        </li>
        <li>
          FounderOS tasks sync two-way with a dedicated &quot;FounderOS&quot; list in Google Tasks.
          Tasks added directly in Google Tasks won&apos;t appear here, since they have no company or
          priority.
        </li>
      </ul>
    </SettingsSection>
  );
}

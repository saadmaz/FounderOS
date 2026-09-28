import "server-only";
import crypto from "node:crypto";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { getAppUrl } from "@/lib/email/app-url";
import type { GoogleCalendarConnection } from "@/lib/types";
import { calendarClientFor } from "./client";

/**
 * Registers (or renews) a push-notification channel for a connection's
 * calendar. Best-effort and silent on failure: Google requires
 * the receiving domain to be verified in Google Cloud Console before
 * `watch()` succeeds, so until the user does that one-time step this is
 * expected to fail - real-time delivery just doesn't kick in yet. Sync
 * still works correctly via the cron reconcile job (src/app/api/cron/
 * google-calendar-reconcile), just with a few minutes of lag instead of
 * near-instant, so a failure here must never block the caller.
 */
export async function startWatch(connection: GoogleCalendarConnection): Promise<void> {
  const token = process.env.GOOGLE_CALENDAR_WEBHOOK_TOKEN;
  if (!token) return;

  const calendar = calendarClientFor(connection);
  const channelId = crypto.randomUUID();
  try {
    const res = await calendar.events.watch({
      calendarId: connection.calendarId,
      requestBody: {
        id: channelId,
        type: "web_hook",
        address: `${getAppUrl()}/api/integrations/google-calendar/webhook`,
        token,
        // Google caps calendar watch channels at ~7 days - the renew cron
        // rotates this well before it expires.
        expiration: String(Date.now() + 6 * 24 * 60 * 60 * 1000),
      },
    });
    const patch: Record<string, unknown> = {
      channelId: res.data.id ?? channelId,
      resourceId: res.data.resourceId ?? null,
    };
    if (res.data.expiration) patch.channelExpiration = Number(res.data.expiration);
    await getAdminFirestore().doc(`googleCalendarConnections/${connection.uid}`).update(patch);
  } catch (err) {
    console.error(
      `Google Calendar watch() failed for ${connection.uid} (falling back to cron sync):`,
      err
    );
  }
}

export async function stopWatch(connection: GoogleCalendarConnection): Promise<void> {
  if (!connection.channelId || !connection.resourceId) return;
  const calendar = calendarClientFor(connection);
  try {
    await calendar.channels.stop({
      requestBody: { id: connection.channelId, resourceId: connection.resourceId },
    });
  } catch (err) {
    console.error(`Failed to stop Google Calendar watch channel for ${connection.uid}:`, err);
  }
}

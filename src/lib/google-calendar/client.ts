/**
 * Server-only Google API client plumbing for the Calendar sync integration.
 * Never import this from a "use client" module - see
 * src/lib/firebase/admin.ts for why (same reasoning, same rule).
 */
import "server-only";
// The scoped @googleapis/calendar package (Calendar API only) instead of the
// full `googleapis` monorepo package - the latter ships generated types for
// ~200 unrelated Google APIs, which is heavy enough to OOM a TypeScript
// build over a single Calendar integration.
import { auth, calendar, type calendar_v3 } from "@googleapis/calendar";
import { getAdminFirestore } from "@/lib/firebase/admin";
import type { GoogleCalendarConnection } from "@/lib/types";

function envOrThrow(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} isn't configured - Google Calendar sync needs GOOGLE_OAUTH_CLIENT_ID, ` +
        "GOOGLE_OAUTH_CLIENT_SECRET, and GOOGLE_OAUTH_REDIRECT_URI (see .env)."
    );
  }
  return value;
}

/** Cheap enough to check before offering the "Connect" button - lets the
 * rest of the app run fine with the integration simply inactive. */
export function isGoogleCalendarConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_OAUTH_CLIENT_ID &&
      process.env.GOOGLE_OAUTH_CLIENT_SECRET &&
      process.env.GOOGLE_OAUTH_REDIRECT_URI
  );
}

export function createOAuthClient() {
  return new auth.OAuth2(
    envOrThrow("GOOGLE_OAUTH_CLIENT_ID"),
    envOrThrow("GOOGLE_OAUTH_CLIENT_SECRET"),
    envOrThrow("GOOGLE_OAUTH_REDIRECT_URI")
  );
}

/**
 * Builds an authenticated Calendar client for a connection. googleapis
 * refreshes the access token automatically ~5 minutes before it expires;
 * the `tokens` listener persists whatever it refreshes back to Firestore so
 * the next call doesn't have to refresh again.
 */
export function calendarClientFor(connection: GoogleCalendarConnection): calendar_v3.Calendar {
  const oauth2 = createOAuthClient();
  oauth2.setCredentials({
    access_token: connection.accessToken,
    refresh_token: connection.refreshToken,
    expiry_date: connection.expiryDate,
    scope: connection.scope,
  });
  oauth2.on("tokens", (tokens) => {
    const patch: Record<string, unknown> = {};
    if (tokens.access_token) patch.accessToken = tokens.access_token;
    if (tokens.refresh_token) patch.refreshToken = tokens.refresh_token;
    if (tokens.expiry_date) patch.expiryDate = tokens.expiry_date;
    if (Object.keys(patch).length === 0) return;
    getAdminFirestore()
      .doc(`googleCalendarConnections/${connection.uid}`)
      .update(patch)
      .catch((err) => console.error("Failed to persist refreshed Google tokens:", err));
  });
  return calendar({ version: "v3", auth: oauth2 });
}

export async function getConnection(uid: string): Promise<GoogleCalendarConnection | null> {
  const snap = await getAdminFirestore().doc(`googleCalendarConnections/${uid}`).get();
  if (!snap.exists) return null;
  return snap.data() as GoogleCalendarConnection;
}

export async function markConnectionError(uid: string, err: unknown): Promise<void> {
  const message = err instanceof Error ? err.message : String(err);
  await getAdminFirestore()
    .doc(`googleCalendarConnections/${uid}`)
    .update({ status: "error", lastError: message })
    .catch(() => {});
}

export async function markConnectionHealthy(uid: string): Promise<void> {
  await getAdminFirestore()
    .doc(`googleCalendarConnections/${uid}`)
    .update({ status: "connected", lastError: null, lastSyncedAt: Date.now() })
    .catch(() => {});
}

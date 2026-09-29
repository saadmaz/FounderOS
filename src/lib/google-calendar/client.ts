/**
 * Server-only Google API client plumbing for the Calendar sync integration.
 * Never import this from a "use client" module - see
 * src/lib/firebase/admin.ts for why (same reasoning, same rule).
 */
import "server-only";
// The scoped @googleapis/calendar and @googleapis/tasks packages (one API
// each) instead of the full `googleapis` monorepo package - the latter
// ships generated types for ~200 unrelated Google APIs, which is heavy
// enough to OOM a TypeScript build over what's really two small
// integrations (Calendar events, Google Tasks).
import { auth, calendar, type calendar_v3 } from "@googleapis/calendar";
import { tasks, type tasks_v1 } from "@googleapis/tasks";
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
 * Builds an authenticated OAuth2 client for a connection. googleapis
 * refreshes the access token automatically ~5 minutes before it expires;
 * the `tokens` listener persists whatever it refreshes back to Firestore so
 * the next call doesn't have to refresh again. Shared by calendarClientFor
 * and tasksClientFor below so a refresh from either API's calls only
 * registers (and persists through) one listener, not two.
 */
function authorizedClientFor(connection: GoogleCalendarConnection) {
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
  return oauth2;
}

export function calendarClientFor(connection: GoogleCalendarConnection): calendar_v3.Calendar {
  return calendar({ version: "v3", auth: authorizedClientFor(connection) });
}

export function tasksClientFor(connection: GoogleCalendarConnection): tasks_v1.Tasks {
  return tasks({ version: "v1", auth: authorizedClientFor(connection) });
}

/** True for Google API responses that mean "you're going too fast," not
 * "this request is wrong" - `code` is a plain HTTP 429, or a 403 whose
 * body's `errors[].reason` names a rate/quota limit specifically (Calendar
 * and Tasks both use 403 for this, confusingly the same code used for a
 * real permission denial - the reason field is what actually distinguishes
 * them). See withGoogleRetry below for why this matters. */
function isRateLimited(err: unknown): boolean {
  const e = err as { code?: number; message?: string; errors?: Array<{ reason?: string }> };
  if (e?.code === 429) return true;
  const reason = e?.errors?.[0]?.reason;
  if (reason === "rateLimitExceeded" || reason === "userRateLimitExceeded" || reason === "quotaExceeded") {
    return true;
  }
  return e?.code === 403 && /quota|rate limit/i.test(e.message ?? "");
}

/**
 * Retries a single Google API call with exponential backoff (+ jitter) on a
 * rate-limit response, up to `attempts` times - anything else (a real
 * permission error, a 404, a network failure) rethrows immediately on the
 * first try. Every write in sync.ts and task-sync.ts goes through this:
 * without it, a workspace with enough calendar/task history to push in one
 * burst reliably hits Calendar's "queries per minute per user" quota, and
 * that one transient error was marking the *whole* connection as broken
 * (see markConnectionError) even though most items had already synced fine
 * and would keep succeeding on the very next request.
 */
export async function withGoogleRetry<T>(fn: () => Promise<T>, attempts = 5): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= attempts - 1 || !isRateLimited(err)) throw err;
      const delayMs = 500 * 2 ** attempt + Math.random() * 300;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
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

const SYNC_LOCK_MS = 5 * 60 * 1000;

/**
 * Prevents overlapping full-sync runs for the same connection. Repeated
 * "Sync now" clicks, or the reconcile cron landing while a manual sync is
 * still in flight, had nothing stopping them from running concurrently -
 * each one on its own stayed under Calendar's per-minute rate limit, but
 * stacked on top of each other they didn't. Returns false (and does
 * nothing) if a sync is already in progress; true if this call acquired
 * the lock and should proceed - see runFullSync in ./full-sync.ts, the
 * only caller. Not a Firestore transaction (just a read then a write), but
 * that's fine here: this guards against a frustrated user clicking a
 * button several times or two schedules overlapping, not a hostile actor
 * racing it on purpose.
 */
export async function acquireSyncLock(uid: string): Promise<boolean> {
  const ref = getAdminFirestore().doc(`googleCalendarConnections/${uid}`);
  const snap = await ref.get();
  const lockedUntil = (snap.data() as GoogleCalendarConnection | undefined)?.syncLockedUntil;
  if (lockedUntil && lockedUntil > Date.now()) return false;
  await ref.update({ syncLockedUntil: Date.now() + SYNC_LOCK_MS });
  return true;
}

export async function releaseSyncLock(uid: string): Promise<void> {
  await getAdminFirestore()
    .doc(`googleCalendarConnections/${uid}`)
    .update({ syncLockedUntil: null })
    .catch(() => {});
}

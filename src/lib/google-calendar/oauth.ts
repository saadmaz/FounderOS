import "server-only";
import { createOAuthClient } from "./client";

/**
 * `calendar.events` grants read/write on events across the connected
 * account's calendars (needed for "primary" - see src/lib/google-calendar/
 * sync.ts), not just calendars/events this app itself created. That's a
 * deliberate, explicit choice: every event on the connected primary
 * calendar becomes visible to the whole FounderOS workspace, not just
 * FounderOS-originated ones.
 *
 * `tasks` grants read/write on Google Tasks (see ./task-sync.ts) - the
 * "Tasks" panel inside Google Calendar, a separate API from Calendar
 * events. This is push-only (FounderOS -> Google), so read access isn't
 * strictly needed, but Google doesn't offer a write-only Tasks scope.
 *
 * Anyone who connected before either of these scopes was added needs to
 * disconnect and reconnect to grant them - Google won't silently upgrade
 * an existing grant.
 */
export const GOOGLE_CALENDAR_SCOPES = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/tasks",
];

export function buildConsentUrl(state: string): string {
  const oauth2 = createOAuthClient();
  return oauth2.generateAuthUrl({
    access_type: "offline",
    // Forces Google to hand back a refresh_token even if this account
    // already granted these scopes once before (otherwise a reconnect
    // after a revoke would silently omit it).
    prompt: "consent",
    scope: GOOGLE_CALENDAR_SCOPES,
    state,
  });
}

export async function exchangeCodeForTokens(code: string) {
  const oauth2 = createOAuthClient();
  const { tokens } = await oauth2.getToken(code);
  if (!tokens.access_token || !tokens.refresh_token || !tokens.id_token) {
    throw new Error("Google didn't return the expected tokens - reconnect to grant access again.");
  }

  // The `openid` scope gets us an id_token (a signed JWT) alongside the
  // access/refresh tokens - verifying it locally gets the account email
  // without a second network call to a separate userinfo API.
  const ticket = await oauth2.verifyIdToken({
    idToken: tokens.id_token,
    audience: process.env.GOOGLE_OAUTH_CLIENT_ID,
  });
  const email = ticket.getPayload()?.email;
  if (!email) {
    throw new Error("Google didn't return an account email.");
  }

  return {
    email,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiryDate: tokens.expiry_date ?? Date.now() + 3600_000,
    scope: tokens.scope ?? GOOGLE_CALENDAR_SCOPES.join(" "),
  };
}

export async function revokeConnectionTokens(refreshToken: string): Promise<void> {
  const oauth2 = createOAuthClient();
  try {
    await oauth2.revokeToken(refreshToken);
  } catch (err) {
    // Already-revoked/expired tokens throw here - fine, we're disconnecting
    // anyway, so there's nothing left worth doing about it.
    console.error("Google token revoke failed (continuing with local disconnect):", err);
  }
}

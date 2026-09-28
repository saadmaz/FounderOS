import { after, NextResponse } from "next/server";
import { getAppUrl } from "@/lib/email/app-url";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { exchangeCodeForTokens } from "@/lib/google-calendar/oauth";
import { pullChangesForConnection, pushAllExistingItems } from "@/lib/google-calendar/sync";
import { startWatch } from "@/lib/google-calendar/watch";
import type { GoogleCalendarConnection } from "@/lib/types";

export const runtime = "nodejs";
// See the reconcile cron route for why this stays within the Hobby plan's
// ceiling - matters less here since the backfill runs via after() below
// (the redirect isn't blocked on it), but the function invocation is still
// subject to this cap while that background work finishes.
export const maxDuration = 60;

const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

function redirectToProfile(status: "connected" | "denied" | "error") {
  return NextResponse.redirect(`${getAppUrl()}/profile?googleCalendar=${status}`);
}

/**
 * Google redirects the browser here after consent. There's no Authorization
 * header on a plain navigation, so identity comes from `state` - the
 * single-use `oauthStates` doc the connect route minted right before
 * sending the user to Google.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const stateId = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) return redirectToProfile("denied");
  if (!code || !stateId) return redirectToProfile("error");

  const db = getAdminFirestore();
  const stateRef = db.collection("oauthStates").doc(stateId);
  const stateSnap = await stateRef.get();
  if (!stateSnap.exists) return redirectToProfile("error");
  const state = stateSnap.data() as { uid: string; workspaceId: string; createdAt: number };
  await stateRef.delete(); // single-use, regardless of what happens below

  if (Date.now() - state.createdAt > OAUTH_STATE_TTL_MS) {
    return redirectToProfile("error");
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const connection: GoogleCalendarConnection = {
      uid: state.uid,
      workspaceId: state.workspaceId,
      googleEmail: tokens.email,
      // The literal "primary" is Google's own alias for "this account's
      // main calendar" - no lookup/creation needed, unlike the old
      // dedicated-calendar design (see sync.ts's module docstring).
      calendarId: "primary",
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiryDate: tokens.expiryDate,
      scope: tokens.scope,
      status: "connected",
      connectedAt: Date.now(),
    };
    await db
      .doc(`googleCalendarConnections/${state.uid}`)
      .set({ ...connection, lastError: null }, { merge: true });

    await startWatch(connection); // best-effort, never blocks connecting
    // Both directions run in the background (not awaited) so the redirect
    // below fires immediately instead of making the browser wait on a
    // potentially large initial two-way sync: pull imports the account's
    // existing calendar history into FounderOS, push backfills existing
    // FounderOS items out to Google (see pushAllExistingItems's docstring).
    after(() => pullChangesForConnection(state.uid));
    after(() => pushAllExistingItems(state.uid, state.workspaceId));

    return redirectToProfile("connected");
  } catch (err) {
    console.error("Google Calendar OAuth callback failed:", err);
    return redirectToProfile("error");
  }
}

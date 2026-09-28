import { NextResponse } from "next/server";
import { getAppUrl } from "@/lib/email/app-url";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { calendarClientFor } from "@/lib/google-calendar/client";
import { exchangeCodeForTokens } from "@/lib/google-calendar/oauth";
import { ensureFounderosCalendar, pushAllExistingItems } from "@/lib/google-calendar/sync";
import { startWatch } from "@/lib/google-calendar/watch";
import type { GoogleCalendarConnection } from "@/lib/types";

export const runtime = "nodejs";
// Generous but still Hobby-plan-safe - see the reconcile cron route for why
// this ceiling matters (an out-of-range maxDuration blocks the whole
// deploy, the same way an out-of-range cron schedule does). The initial
// backfill below (pushAllExistingItems) is the slow part on a workspace
// with a lot of history.
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
    const connectionRef = db.doc(`googleCalendarConnections/${state.uid}`);
    await connectionRef.set(
      {
        uid: state.uid,
        workspaceId: state.workspaceId,
        googleEmail: tokens.email,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiryDate: tokens.expiryDate,
        scope: tokens.scope,
        status: "connected",
        lastError: null,
        connectedAt: Date.now(),
      },
      { merge: true }
    );

    const saved = (await connectionRef.get()).data() as GoogleCalendarConnection;
    const calendar = calendarClientFor(saved);
    const calendarId = await ensureFounderosCalendar(calendar, saved);
    await startWatch({ ...saved, calendarId }); // best-effort, never blocks connecting
    await pushAllExistingItems(state.uid, state.workspaceId); // backfill - see its docstring

    return redirectToProfile("connected");
  } catch (err) {
    console.error("Google Calendar OAuth callback failed:", err);
    return redirectToProfile("error");
  }
}

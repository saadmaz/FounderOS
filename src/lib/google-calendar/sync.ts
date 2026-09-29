/**
 * The actual bidirectional sync engine: FounderOS <-> each connected
 * member's actual primary Google Calendar (by explicit choice - see the
 * connect flow's consent copy - meaning every event on that calendar
 * becomes visible to the whole workspace, not just events created through
 * FounderOS or a dedicated calendar. This app used to sync a separate
 * dedicated "FounderOS" calendar instead, specifically to avoid that; that
 * changed on request, so the OAuth scope is now the broader
 * `calendar.events` (see ./oauth.ts) rather than the narrower
 * `calendar.app.created`.
 *
 * Push (FounderOS -> Google) is called right after a client-side Firestore
 * write, from POST /api/integrations/google-calendar/push - see
 * notifyGoogleSync() in src/lib/data/calendar-events.ts and meetings.ts.
 *
 * Pull (Google -> FounderOS) is called from the webhook route when Google
 * notifies us of a change, and on a timer from the reconcile cron - both
 * just call pullChangesForConnection() for the affected connection(s). The
 * cron is the source of truth; the webhook only shortens the delay.
 *
 * Loop prevention: every Google event FounderOS creates carries
 * extendedProperties.private.founderosId. After each push we record the
 * resulting Google event's `updated` timestamp on the link doc
 * (lastPushedGoogleUpdated). A pulled change whose `updated` matches that
 * value is our own echo, not a real external edit, and gets skipped.
 */
import "server-only";
import crypto from "node:crypto";
import type { calendar_v3 } from "@googleapis/calendar";
import { getAdminFirestore } from "@/lib/firebase/admin";
import type {
  CalendarEvent,
  GoogleCalendarConnection,
  GoogleCalendarLink,
  Meeting,
  WorkspaceMember,
} from "@/lib/types";
import { calendarClientFor, getConnection, markConnectionError, markConnectionHealthy, withGoogleRetry } from "./client";

type ItemKind = "event" | "meeting";

// ---------------------------------------------------------------- helpers --

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Local-timezone calendar date, matching how the client itself builds
 * allDay timestamps (`new Date(\`${date}T00:00\`)`, i.e. no explicit
 * offset) - the whole app is timezone-naive by the same convention (see
 * the `new Date()` comment in src/app/(app)/calendar/page.tsx), so the
 * server's own local timezone is the closest thing to "the team's
 * timezone" available anywhere in this codebase. */
function localDateOf(ms: number, addDays = 0): string {
  const d = new Date(ms);
  if (addDays) d.setDate(d.getDate() + addDays);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function toGoogleDate(ms: number, allDay: boolean, isEnd: boolean): calendar_v3.Schema$EventDateTime {
  if (allDay) return { date: localDateOf(ms, isEnd ? 1 : 0) };
  return { dateTime: new Date(ms).toISOString() };
}

function fromGoogleDate(dt: calendar_v3.Schema$EventDateTime | undefined): {
  ms: number;
  allDay: boolean;
} {
  if (dt?.date) return { ms: new Date(`${dt.date}T00:00`).getTime(), allDay: true };
  if (dt?.dateTime) return { ms: new Date(dt.dateTime).getTime(), allDay: false };
  return { ms: Date.now(), allDay: false };
}

/** Local copy of src/lib/data/firestore-helpers.ts's omitUndefined - that
 * file pulls in the client "firebase" package, which server-only Admin-SDK
 * code (this module) deliberately never imports, so this stays duplicated
 * rather than crossing that boundary for one 5-line helper. Exported for
 * reuse by ./task-sync.ts. */
export function omitUndefined<T extends Record<string, unknown>>(obj: T): T {
  const result = {} as T;
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) (result as Record<string, unknown>)[key] = value;
  }
  return result;
}

/** Exported for reuse by ./task-sync.ts. */
export function hashOf(value: unknown): string {
  return crypto.createHash("sha1").update(JSON.stringify(value)).digest("hex");
}

function linkDocId(uid: string, kind: ItemKind, itemId: string): string {
  return `${uid}_${kind}_${itemId}`;
}

/** Runs `fn` over `items` with at most `limit` in flight at once - plain
 * `for...of await` here would serialize dozens of Google API round-trips
 * (a workspace with any real history easily has 50+ events once recurring
 * series are counted), which is what blew past the backfill route's
 * maxDuration and surfaced as a 504 to the browser. No new dependency for
 * something this small. Exported for reuse by ./task-sync.ts. */
export async function mapWithConcurrency<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const item = items[index++];
      await fn(item);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

async function getMembers(workspaceId: string): Promise<WorkspaceMember[]> {
  const snap = await getAdminFirestore().collection(`workspaces/${workspaceId}/members`).get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<WorkspaceMember, "id">) }));
}

// ------------------------------------------------------------- field maps --

function fieldsForCalendarEvent(item: CalendarEvent): calendar_v3.Schema$Event {
  const endMs = item.allDay ? item.startsAt : (item.endsAt ?? item.startsAt + 60 * 60 * 1000);
  const typeLabel = { event: "Event", deadline: "Deadline", reminder: "Reminder" }[item.type];
  return {
    summary: item.title,
    description: [item.notes, `FounderOS ${typeLabel}`].filter(Boolean).join("\n\n"),
    start: toGoogleDate(item.startsAt, item.allDay, false),
    end: toGoogleDate(endMs, item.allDay, true),
  };
}

function fieldsForMeeting(item: Meeting, attendeeEmails: string[]): calendar_v3.Schema$Event {
  const endMs = item.scheduledAt + item.durationMinutes * 60_000;
  return {
    summary: item.title,
    description: [item.agenda, item.notes, "FounderOS Meeting"].filter(Boolean).join("\n\n"),
    location: item.location || undefined,
    start: toGoogleDate(item.scheduledAt, false, false),
    end: toGoogleDate(endMs, false, true),
    attendees: attendeeEmails.map((email) => ({ email })),
  };
}

/** Reverse map for a genuinely external edit to an already-linked event -
 * intentionally narrower than the forward map (title/timing/location only,
 * not description) since unpacking our own composed description string
 * back into `notes`/`agenda` would be lossy guesswork; those stay
 * FounderOS -> Google only. */
function calendarEventPatchFromGoogle(e: calendar_v3.Schema$Event): Partial<CalendarEvent> {
  const start = fromGoogleDate(e.start);
  const end = e.end ? fromGoogleDate(e.end) : null;
  return omitUndefined({
    title: e.summary || "(untitled)",
    allDay: start.allDay,
    startsAt: start.ms,
    endsAt: !start.allDay && end ? end.ms : null,
  });
}

function meetingPatchFromGoogle(e: calendar_v3.Schema$Event): Partial<Meeting> {
  const start = fromGoogleDate(e.start);
  const end = e.end ? fromGoogleDate(e.end) : null;
  const durationMinutes = end ? Math.max(5, Math.round((end.ms - start.ms) / 60_000)) : 30;
  return omitUndefined({
    title: e.summary || "(untitled)",
    scheduledAt: start.ms,
    durationMinutes,
    location: e.location || undefined,
  });
}

// ------------------------------------------------------------------ push --

async function itemDocRef(workspaceId: string, kind: ItemKind, itemId: string) {
  const collectionName = kind === "event" ? "calendarEvents" : "meetings";
  return getAdminFirestore().doc(`workspaces/${workspaceId}/${collectionName}/${itemId}`);
}

/** Pushes one FounderOS item to one connected user's Google calendar.
 * Insert-or-patch based on the stored link; no-ops if nothing changed since
 * the last push. Never throws - sync failures are recorded on the
 * connection instead, so one bad item/user never blocks the rest of a
 * fan-out. */
export async function pushItemToGoogle(
  uid: string,
  workspaceId: string,
  kind: ItemKind,
  itemId: string
): Promise<void> {
  try {
    const connection = await getConnection(uid);
    if (!connection) return;

    const docSnap = await (await itemDocRef(workspaceId, kind, itemId)).get();
    if (!docSnap.exists) {
      await deleteItemFromGoogle(uid, workspaceId, kind, itemId);
      return;
    }

    const calendar = calendarClientFor(connection);
    const calendarId = connection.calendarId;

    let fields: calendar_v3.Schema$Event;
    if (kind === "event") {
      fields = fieldsForCalendarEvent({ id: docSnap.id, ...(docSnap.data() as object) } as CalendarEvent);
    } else {
      const meeting = { id: docSnap.id, ...(docSnap.data() as object) } as Meeting;
      const members = await getMembers(workspaceId);
      const emails = members
        .filter((m) => meeting.attendeeIds.includes(m.id))
        .map((m) => m.email);
      fields = fieldsForMeeting(meeting, emails);
    }
    fields.extendedProperties = {
      private: { founderosId: itemId, founderosKind: kind, founderosWorkspaceId: workspaceId, founderosUid: uid },
    };

    const contentHash = hashOf(fields);
    const linkRef = getAdminFirestore().doc(
      `workspaces/${workspaceId}/googleEventLinks/${linkDocId(uid, kind, itemId)}`
    );
    const linkSnap = await linkRef.get();
    const link = linkSnap.exists ? (linkSnap.data() as GoogleCalendarLink) : null;

    if (link && link.contentHash === contentHash) return; // nothing changed

    let result: calendar_v3.Schema$Event | null | undefined;
    if (link?.googleEventId) {
      try {
        result = (
          await withGoogleRetry(() =>
            calendar.events.patch({ calendarId, eventId: link.googleEventId, requestBody: fields })
          )
        ).data;
      } catch (err) {
        if (!isGoogleNotFound(err)) throw err;
        result = null; // deleted on the Google side - fall through and re-insert
      }
    }
    if (!result) {
      result = (await withGoogleRetry(() => calendar.events.insert({ calendarId, requestBody: fields }))).data;
    }
    if (!result.id) throw new Error("Google didn't return an event id.");

    await linkRef.set(
      omitUndefined({
        uid,
        workspaceId,
        kind,
        itemId,
        googleEventId: result.id,
        lastPushedGoogleUpdated: result.updated,
        contentHash,
        updatedAt: Date.now(),
      })
    );
    await markConnectionHealthy(uid);
  } catch (err) {
    console.error(`Failed to push ${kind} ${itemId} to Google for ${uid}:`, err);
    await markConnectionError(uid, err);
  }
}

export async function deleteItemFromGoogle(
  uid: string,
  workspaceId: string,
  kind: ItemKind,
  itemId: string
): Promise<void> {
  const linkRef = getAdminFirestore().doc(
    `workspaces/${workspaceId}/googleEventLinks/${linkDocId(uid, kind, itemId)}`
  );
  const linkSnap = await linkRef.get();
  if (!linkSnap.exists) return;
  const link = linkSnap.data() as GoogleCalendarLink;

  const connection = await getConnection(uid);
  if (connection) {
    try {
      const calendar = calendarClientFor(connection);
      await withGoogleRetry(() =>
        calendar.events.delete({ calendarId: connection.calendarId, eventId: link.googleEventId })
      );
    } catch (err) {
      if (!isGoogleNotFound(err)) console.error(`Failed to delete Google event for ${uid}:`, err);
    }
  }
  await linkRef.delete();
}

/** Fans a FounderOS change out to every connected user who should see it -
 * called by POST /api/integrations/google-calendar/push. Events go to every
 * connected workspace member; meetings only to connected attendees. */
export async function pushToRelevantUsers(
  workspaceId: string,
  kind: ItemKind,
  itemIds: string[],
  deleted: boolean
): Promise<void> {
  const connectionsSnap = await getAdminFirestore()
    .collection("googleCalendarConnections")
    .where("workspaceId", "==", workspaceId)
    .get();
  const connections = connectionsSnap.docs
    .map((d) => d.data() as GoogleCalendarConnection)
    .filter((c) => c.status === "connected");
  if (connections.length === 0) return;

  for (const itemId of itemIds) {
    if (deleted) {
      // The FounderOS doc is already gone, so we can't re-derive who it was
      // relevant to - fan out to whoever we previously pushed it to.
      const linksSnap = await getAdminFirestore()
        .collection(`workspaces/${workspaceId}/googleEventLinks`)
        .where("kind", "==", kind)
        .where("itemId", "==", itemId)
        .get();
      await Promise.all(
        linksSnap.docs.map((d) => deleteItemFromGoogle((d.data() as GoogleCalendarLink).uid, workspaceId, kind, itemId))
      );
      continue;
    }

    let relevantUids: string[];
    if (kind === "event") {
      relevantUids = connections.map((c) => c.uid);
    } else {
      const meetingSnap = await (await itemDocRef(workspaceId, kind, itemId)).get();
      if (!meetingSnap.exists) continue;
      const meeting = meetingSnap.data() as Meeting;
      relevantUids = connections.filter((c) => meeting.attendeeIds.includes(c.uid)).map((c) => c.uid);
    }
    await Promise.all(relevantUids.map((uid) => pushItemToGoogle(uid, workspaceId, kind, itemId)));
  }
}

/**
 * One-time backfill of everything already on the FounderOS calendar into a
 * newly (or freshly re-)connected user's Google calendar - without this,
 * connecting only starts syncing *future* changes, so the Google calendar
 * looks empty even though the FounderOS one isn't. Called right after
 * connecting (src/app/api/integrations/google-calendar/callback) and from
 * the manual "Sync now" action, so an already-connected user can trigger it
 * too. Safe to call repeatedly - pushItemToGoogle no-ops on items whose
 * content hash hasn't changed since the last push.
 */
export async function pushAllExistingItems(uid: string, workspaceId: string): Promise<void> {
  const db = getAdminFirestore();
  // Kept low deliberately - see withGoogleRetry's docstring in ./client.ts.
  // A full-history backfill pushing many items at once is exactly what hit
  // Calendar's "queries per minute per user" quota; a lower concurrency
  // spreads the burst out instead of firing it all in the same instant.
  const CONCURRENCY = 3;

  const eventsSnap = await db.collection(`workspaces/${workspaceId}/calendarEvents`).get();
  await mapWithConcurrency(eventsSnap.docs, CONCURRENCY, (doc) =>
    pushItemToGoogle(uid, workspaceId, "event", doc.id)
  );

  const meetingsSnap = await db
    .collection(`workspaces/${workspaceId}/meetings`)
    .where("attendeeIds", "array-contains", uid)
    .get();
  await mapWithConcurrency(meetingsSnap.docs, CONCURRENCY, (doc) =>
    pushItemToGoogle(uid, workspaceId, "meeting", doc.id)
  );
}

function isGoogleNotFound(err: unknown): boolean {
  const code = (err as { code?: number })?.code;
  return code === 404 || code === 410;
}

// ------------------------------------------------------------------ pull --

/** Incrementally pulls Google-side changes for one connection into
 * Firestore. Called by the webhook route (on notification) and the
 * reconcile cron (on a timer, for every connection) - the cron is the
 * always-on baseline, the webhook just shortens the delay. Never throws;
 * failures are recorded on the connection. */
export async function pullChangesForConnection(uid: string): Promise<void> {
  const connection = await getConnection(uid);
  if (!connection) return;

  try {
    const calendar = calendarClientFor(connection);
    const calendarId = connection.calendarId;

    let pageToken: string | undefined;
    let syncToken = connection.syncToken;
    let nextSyncToken: string | undefined;
    let restarted = false;

    for (;;) {
      let page;
      try {
        page = await withGoogleRetry(() =>
          calendar.events.list({
            calendarId,
            syncToken,
            pageToken,
            showDeleted: true,
            singleEvents: true,
            // Google's own auto-generated event types (birthdays, working
            // location, out-of-office, focus time, Gmail-detected events) -
            // "default" is a normal event. These aren't meaningful on a
            // shared company calendar, and some of them (birthday) reject
            // extendedProperties outright, which is what was crashing the
            // whole pull - see the per-event try/catch below for the other
            // half of that fix.
            eventTypes: ["default"],
            // Only on a full sync (no syncToken yet) - timeMin/timeMax
            // can't be combined with syncToken at all, Google rejects it.
            // Bounding how far back a *first* import reaches matters a lot
            // here: every pre-existing event without our tag needs its own
            // extra write call to tag it (see applyGoogleEvent's "brand
            // new event" branch below), so a primary calendar with months
            // or years of real history turns into hundreds of write calls
            // in one run - that, not any single request, is what was
            // exhausting the per-minute quota even with retries and a lock
            // against overlapping runs. Google remembers a sync token's
            // original query params, so this window carries forward into
            // every later incremental sync too, not just this one. Kept
            // tight (30, not 90, days) so a first pull has a real chance
            // of finishing inside one request's time budget rather than
            // getting killed mid-run with nothing committed - see
            // pullChangesForConnection's docstring above for why a killed
            // run currently loses all its progress, not just the rest.
            ...(!syncToken ? { timeMin: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() } : {}),
          })
        );
      } catch (err) {
        // 410 = sync token expired/invalid outright. 400 = Google also
        // returns this when the token was issued under different request
        // parameters than the current call (e.g. it predates the
        // eventTypes filter added above) - same fix applies to both: drop
        // the token and do exactly one full resync (guarded by `restarted`
        // so a persistently broken token, or a 400 for some unrelated
        // reason, can't loop forever - it'll surface as a real error on
        // the second attempt instead).
        const code = (err as { code?: number })?.code;
        if ((code === 410 || code === 400) && syncToken && !restarted) {
          syncToken = undefined;
          pageToken = undefined;
          restarted = true;
          continue;
        }
        throw err;
      }

      // Applied per page, right away - not collected across every page
      // and only applied at the end. A killed invocation (Vercel enforces
      // maxDuration by force-terminating, so there's no cleanup hook to
      // rely on here) used to lose everything it had fetched so far; now
      // whatever page it got through is already durably in Firestore, and
      // a retry that re-fetches an already-applied page mostly no-ops
      // (see applyGoogleEvent's echo check), so it's strictly faster than
      // the last attempt instead of starting cold every time.
      //
      // Concurrency-limited for the same reason as pushAllExistingItems -
      // a primary calendar with real history can easily be hundreds of
      // events even within the 30-day window above. Each event is
      // isolated in its own try/catch: one malformed or unexpected event
      // must never abort the batch, because that also means the sync
      // token below never advances - the next pull would just hit the
      // same bad event again, forever, exactly what happened with
      // Google's special event types before the eventTypes filter above.
      const pageEvents = page.data.items ?? [];
      await mapWithConcurrency(pageEvents, 3, async (event) => {
        try {
          await applyGoogleEvent(uid, connection.workspaceId, event);
        } catch (err) {
          console.error(`Failed to apply pulled Google event ${event.id} for ${uid} (skipping it):`, err);
        }
      });

      pageToken = page.data.nextPageToken ?? undefined;
      nextSyncToken = page.data.nextSyncToken ?? nextSyncToken;
      if (!pageToken) break;
    }

    const patch: Record<string, unknown> = { lastSyncedAt: Date.now(), status: "connected", lastError: null };
    if (nextSyncToken) patch.syncToken = nextSyncToken;
    await getAdminFirestore().doc(`googleCalendarConnections/${uid}`).update(patch);
  } catch (err) {
    console.error(`Failed to pull Google Calendar changes for ${uid}:`, err);
    await markConnectionError(uid, err);
  }
}

async function applyGoogleEvent(uid: string, workspaceId: string, event: calendar_v3.Schema$Event): Promise<void> {
  const founderosId = event.extendedProperties?.private?.founderosId;
  const founderosKind = event.extendedProperties?.private?.founderosKind as ItemKind | undefined;

  // Belt-and-suspenders on top of the `eventTypes: ["default"]` filter in
  // pullChangesForConnection's events.list call above - a cancellation of
  // one of these special types can still surface here regardless of that
  // filter (Google's docs don't guarantee it applies identically to a
  // syncToken-driven incremental request), and several of them (birthday,
  // in particular) reject extendedProperties outright, which is exactly
  // what broke this pull before. None of these are meaningful line items
  // on a shared company calendar anyway.
  if (event.eventType && event.eventType !== "default") return;

  if (event.status === "cancelled") {
    if (!founderosId || !founderosKind) return; // an event we never synced - nothing to do
    const linkRef = getAdminFirestore().doc(
      `workspaces/${workspaceId}/googleEventLinks/${linkDocId(uid, founderosKind, founderosId)}`
    );
    const linkSnap = await linkRef.get();
    if (!linkSnap.exists) return; // our own delete already handled this
    await (await itemDocRef(workspaceId, founderosKind, founderosId)).delete();
    await linkRef.delete();
    return;
  }

  if (founderosId && founderosKind) {
    const linkRef = getAdminFirestore().doc(
      `workspaces/${workspaceId}/googleEventLinks/${linkDocId(uid, founderosKind, founderosId)}`
    );
    const linkSnap = await linkRef.get();
    const link = linkSnap.exists ? (linkSnap.data() as GoogleCalendarLink) : null;
    if (link?.lastPushedGoogleUpdated && link.lastPushedGoogleUpdated === event.updated) return; // our own echo

    const patch =
      founderosKind === "event" ? calendarEventPatchFromGoogle(event) : meetingPatchFromGoogle(event);
    await (await itemDocRef(workspaceId, founderosKind, founderosId)).update(patch);
    await linkRef.set(
      omitUndefined({ lastPushedGoogleUpdated: event.updated, contentHash: hashOf(patch), updatedAt: Date.now() }),
      { merge: true }
    );
    return;
  }

  // An event that didn't come from us - either pre-existing history on the
  // connected calendar or something created there directly. Mirror it in
  // as a new CalendarEvent. Google has no "meeting" concept, so anything
  // pulled in fresh always lands as a plain event.
  const patch = calendarEventPatchFromGoogle(event);
  const newDoc = await getAdminFirestore().collection(`workspaces/${workspaceId}/calendarEvents`).add({
    ...patch,
    workspaceId,
    type: "event",
    createdBy: uid,
    createdAt: Date.now(),
  });

  const connection = await getConnection(uid);
  if (connection && event.id) {
    const calendar = calendarClientFor(connection);
    const patched = await withGoogleRetry(() =>
      calendar.events.patch({
        calendarId: connection.calendarId,
        eventId: event.id!,
        requestBody: {
          extendedProperties: {
            private: {
              founderosId: newDoc.id,
              founderosKind: "event",
              founderosWorkspaceId: workspaceId,
              founderosUid: uid,
            },
          },
        },
      })
    );
    await getAdminFirestore()
      .doc(`workspaces/${workspaceId}/googleEventLinks/${linkDocId(uid, "event", newDoc.id)}`)
      .set(
        omitUndefined({
          uid,
          workspaceId,
          kind: "event" as const,
          itemId: newDoc.id,
          googleEventId: event.id,
          lastPushedGoogleUpdated: patched.data.updated,
          contentHash: hashOf(patch),
          updatedAt: Date.now(),
        })
      );
  }
}

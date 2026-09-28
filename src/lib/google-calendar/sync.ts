/**
 * The actual bidirectional sync engine: FounderOS <-> a dedicated "FounderOS"
 * calendar in each connected member's Google account.
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
import { calendarClientFor, getConnection, markConnectionError, markConnectionHealthy } from "./client";

const FOUNDEROS_CALENDAR_SUMMARY = "FounderOS";
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
 * rather than crossing that boundary for one 5-line helper. */
function omitUndefined<T extends Record<string, unknown>>(obj: T): T {
  const result = {} as T;
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) (result as Record<string, unknown>)[key] = value;
  }
  return result;
}

function hashOf(value: unknown): string {
  return crypto.createHash("sha1").update(JSON.stringify(value)).digest("hex");
}

function linkDocId(uid: string, kind: ItemKind, itemId: string): string {
  return `${uid}_${kind}_${itemId}`;
}

async function getMembers(workspaceId: string): Promise<WorkspaceMember[]> {
  const snap = await getAdminFirestore().collection(`workspaces/${workspaceId}/members`).get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<WorkspaceMember, "id">) }));
}

// ------------------------------------------------------- calendar bootstrap --

/** Finds (or creates) the dedicated "FounderOS" calendar in this connected
 * account - see the module docstring for why sync targets a dedicated
 * calendar instead of the user's primary one. */
export async function ensureFounderosCalendar(
  calendar: calendar_v3.Calendar,
  connection: GoogleCalendarConnection
): Promise<string> {
  if (connection.calendarId) {
    try {
      await calendar.calendars.get({ calendarId: connection.calendarId });
      return connection.calendarId;
    } catch {
      // Deleted on the Google side (or never existed) - fall through and
      // create a fresh one below.
    }
  }
  const created = await calendar.calendars.insert({
    requestBody: {
      summary: FOUNDEROS_CALENDAR_SUMMARY,
      description: "Synced from your FounderOS workspace calendar. Don't rename this calendar.",
    },
  });
  const calendarId = created.data.id;
  if (!calendarId) throw new Error("Google didn't return a calendar id after creating it.");
  await getAdminFirestore()
    .doc(`googleCalendarConnections/${connection.uid}`)
    .update({ calendarId });
  return calendarId;
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
    const calendarId = await ensureFounderosCalendar(calendar, connection);

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
        result = (await calendar.events.patch({ calendarId, eventId: link.googleEventId, requestBody: fields }))
          .data;
      } catch (err) {
        if (!isGoogleNotFound(err)) throw err;
        result = null; // deleted on the Google side - fall through and re-insert
      }
    }
    if (!result) {
      result = (await calendar.events.insert({ calendarId, requestBody: fields })).data;
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
      await calendar.events.delete({ calendarId: connection.calendarId, eventId: link.googleEventId });
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

  const eventsSnap = await db.collection(`workspaces/${workspaceId}/calendarEvents`).get();
  for (const doc of eventsSnap.docs) {
    await pushItemToGoogle(uid, workspaceId, "event", doc.id);
  }

  const meetingsSnap = await db
    .collection(`workspaces/${workspaceId}/meetings`)
    .where("attendeeIds", "array-contains", uid)
    .get();
  for (const doc of meetingsSnap.docs) {
    await pushItemToGoogle(uid, workspaceId, "meeting", doc.id);
  }
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
    const calendarId = await ensureFounderosCalendar(calendar, connection);

    let pageToken: string | undefined;
    let syncToken = connection.syncToken;
    let nextSyncToken: string | undefined;
    let restarted = false;
    const events: calendar_v3.Schema$Event[] = [];

    for (;;) {
      let page;
      try {
        page = await calendar.events.list({
          calendarId,
          syncToken,
          pageToken,
          showDeleted: true,
          singleEvents: true,
        });
      } catch (err) {
        if ((err as { code?: number })?.code === 410 && syncToken && !restarted) {
          // Sync token expired/invalid - drop it and do exactly one full
          // resync instead (guarded by `restarted` so a persistently broken
          // token can't loop forever).
          syncToken = undefined;
          pageToken = undefined;
          restarted = true;
          events.length = 0;
          continue;
        }
        throw err;
      }
      events.push(...(page.data.items ?? []));
      pageToken = page.data.nextPageToken ?? undefined;
      nextSyncToken = page.data.nextSyncToken ?? nextSyncToken;
      if (!pageToken) break;
    }

    for (const event of events) {
      await applyGoogleEvent(uid, connection.workspaceId, event);
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

  // A brand-new event created directly in the user's "FounderOS" Google
  // calendar (not through us) - mirror it in as a new CalendarEvent. Google
  // has no "meeting" concept, so anything pulled in fresh always lands as a
  // plain event.
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
    const patched = await calendar.events.patch({
      calendarId: connection.calendarId,
      eventId: event.id,
      requestBody: {
        extendedProperties: {
          private: { founderosId: newDoc.id, founderosKind: "event", founderosWorkspaceId: workspaceId, founderosUid: uid },
        },
      },
    });
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

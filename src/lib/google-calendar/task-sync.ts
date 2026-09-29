/**
 * Two-way sync between FounderOS Tasks and a dedicated "FounderOS" Google
 * Tasks list (the "Tasks" panel inside Google Calendar) in each connected
 * member's account. Separate from src/lib/google-calendar/sync.ts (Calendar
 * events/meetings) because Google Tasks is a genuinely different API with
 * its own OAuth scope - see ./oauth.ts.
 *
 * Single-owner, unlike the Calendar side: a task fans out to its `ownerId`
 * only, not every connected workspace member (mirrors how a Meeting only
 * pushes to its attendees, not the whole workspace - see
 * pushToRelevantUsers in ./sync.ts). A task with no owner, or whose owner
 * isn't connected, simply doesn't sync anywhere.
 *
 * Pull is asymmetric with push, on purpose:
 * - A task edited in Google (title, notes, due date, completion) updates
 *   the linked FounderOS task - see applyGoogleTask.
 * - A task *created* directly in Google Tasks is NOT imported as a new
 *   FounderOS task. A Task requires companyId and priority, neither of
 *   which Google Tasks has any concept of, so there's no valid FounderOS
 *   task to create - see applyGoogleTask's early return for a task with no
 *   existing link.
 * - There's no push notification support for Google Tasks the way Calendar
 *   has watch(), so pullTasksForConnection is only ever polled: from the
 *   manual "Sync now" action and the reconcile cron, never a webhook.
 *
 * A dedicated task list (rather than the account's default "My Tasks")
 * keeps FounderOS-originated tasks visually separate from personal to-dos,
 * the same reasoning the Calendar side used to apply before it was pointed
 * at the primary calendar on request.
 */
import "server-only";
import type { tasks_v1 } from "@googleapis/tasks";
import { getAdminFirestore } from "@/lib/firebase/admin";
import type { GoogleCalendarConnection, GoogleTaskLink, Task, TaskStatus } from "@/lib/types";
import {
  getConnection,
  markConnectionError,
  markConnectionHealthy,
  tasksClientFor,
  withGoogleRetry,
} from "./client";
import { hashOf, mapWithConcurrency, omitUndefined } from "./sync";

const FOUNDEROS_TASKLIST_TITLE = "FounderOS";

function linkDocId(uid: string, taskId: string): string {
  return `${uid}_${taskId}`;
}

async function taskDocRef(workspaceId: string, taskId: string) {
  return getAdminFirestore().doc(`workspaces/${workspaceId}/tasks/${taskId}`);
}

/** Finds (or creates) the dedicated "FounderOS" Google Tasks list in this
 * connected account. */
async function ensureFounderosTaskList(
  tasksApi: tasks_v1.Tasks,
  connection: GoogleCalendarConnection
): Promise<string> {
  if (connection.taskListId) {
    try {
      await withGoogleRetry(() => tasksApi.tasklists.get({ tasklist: connection.taskListId }));
      return connection.taskListId;
    } catch {
      // Deleted on the Google side (or never existed) - fall through and
      // create a fresh one below.
    }
  }
  const created = await withGoogleRetry(() =>
    tasksApi.tasklists.insert({ requestBody: { title: FOUNDEROS_TASKLIST_TITLE } })
  );
  const taskListId = created.data.id;
  if (!taskListId) throw new Error("Google didn't return a task list id after creating it.");
  await getAdminFirestore().doc(`googleCalendarConnections/${connection.uid}`).update({ taskListId });
  return taskListId;
}

function fieldsForTask(task: Task): tasks_v1.Schema$Task {
  const completed = task.status === "completed" || task.status === "cancelled";
  return omitUndefined({
    title: task.title,
    notes: task.description,
    due: task.dueDate ? new Date(task.dueDate).toISOString() : undefined,
    status: completed ? "completed" : "needsAction",
    completed: completed ? new Date(task.completedAt ?? Date.now()).toISOString() : undefined,
  });
}

function isGoogleNotFound(err: unknown): boolean {
  const code = (err as { code?: number })?.code;
  return code === 404 || code === 410;
}

/** Pushes one FounderOS task to its owner's Google Tasks, if the owner has
 * Google Calendar connected. Insert-or-patch based on the stored link;
 * no-ops if nothing changed since the last push. Never throws - failures
 * are recorded on the connection, same as pushItemToGoogle in ./sync.ts. */
export async function pushTaskToGoogle(uid: string, workspaceId: string, taskId: string): Promise<void> {
  try {
    const connection = await getConnection(uid);
    if (!connection) return;

    const docSnap = await (await taskDocRef(workspaceId, taskId)).get();
    if (!docSnap.exists) {
      await deleteTaskFromGoogle(uid, workspaceId, taskId);
      return;
    }

    const tasksApi = tasksClientFor(connection);
    const tasklist = await ensureFounderosTaskList(tasksApi, connection);
    const task = { id: docSnap.id, ...(docSnap.data() as object) } as Task;
    const fields = fieldsForTask(task);
    const contentHash = hashOf(fields);

    const linkRef = getAdminFirestore().doc(`workspaces/${workspaceId}/googleTaskLinks/${linkDocId(uid, taskId)}`);
    const linkSnap = await linkRef.get();
    const link = linkSnap.exists ? (linkSnap.data() as GoogleTaskLink) : null;
    if (link && link.contentHash === contentHash) return; // nothing changed

    let result: tasks_v1.Schema$Task | null | undefined;
    if (link?.googleTaskId) {
      try {
        result = (
          await withGoogleRetry(() =>
            tasksApi.tasks.patch({ tasklist, task: link.googleTaskId, requestBody: fields })
          )
        ).data;
      } catch (err) {
        if (!isGoogleNotFound(err)) throw err;
        result = null; // deleted on the Google side - fall through and re-insert
      }
    }
    if (!result) {
      result = (await withGoogleRetry(() => tasksApi.tasks.insert({ tasklist, requestBody: fields }))).data;
    }
    if (!result.id) throw new Error("Google didn't return a task id.");

    await linkRef.set(
      omitUndefined({
        uid,
        workspaceId,
        taskId,
        googleTaskId: result.id,
        lastPushedGoogleUpdated: result.updated,
        contentHash,
        updatedAt: Date.now(),
      })
    );
    await markConnectionHealthy(uid);
  } catch (err) {
    console.error(`Failed to push task ${taskId} to Google for ${uid}:`, err);
    await markConnectionError(uid, err);
  }
}

export async function deleteTaskFromGoogle(uid: string, workspaceId: string, taskId: string): Promise<void> {
  const linkRef = getAdminFirestore().doc(`workspaces/${workspaceId}/googleTaskLinks/${linkDocId(uid, taskId)}`);
  const linkSnap = await linkRef.get();
  if (!linkSnap.exists) return;
  const link = linkSnap.data() as GoogleTaskLink;

  const connection = await getConnection(uid);
  if (connection?.taskListId) {
    try {
      const tasksApi = tasksClientFor(connection);
      await withGoogleRetry(() =>
        tasksApi.tasks.delete({ tasklist: connection.taskListId!, task: link.googleTaskId })
      );
    } catch (err) {
      if (!isGoogleNotFound(err)) console.error(`Failed to delete Google task for ${uid}:`, err);
    }
  }
  await linkRef.delete();
}

/** Fans a FounderOS task change out to its owner (only) - called by POST
 * /api/integrations/google-calendar/push. */
export async function pushTasksToOwner(workspaceId: string, taskIds: string[], deleted: boolean): Promise<void> {
  for (const taskId of taskIds) {
    if (deleted) {
      // The task doc is already gone, so fall back to whoever we
      // previously pushed it to (there's at most one link, since tasks
      // only ever sync to their single owner).
      const linksSnap = await getAdminFirestore()
        .collection(`workspaces/${workspaceId}/googleTaskLinks`)
        .where("taskId", "==", taskId)
        .get();
      await Promise.all(
        linksSnap.docs.map((d) => deleteTaskFromGoogle((d.data() as GoogleTaskLink).uid, workspaceId, taskId))
      );
      continue;
    }

    const taskSnap = await (await taskDocRef(workspaceId, taskId)).get();
    if (!taskSnap.exists) continue;
    const ownerId = (taskSnap.data() as Task).ownerId;
    if (!ownerId) continue;

    const connectionSnap = await getAdminFirestore().doc(`googleCalendarConnections/${ownerId}`).get();
    if (!connectionSnap.exists || (connectionSnap.data() as GoogleCalendarConnection).status !== "connected") continue;

    await pushTaskToGoogle(ownerId, workspaceId, taskId);
  }
}

/** One-time backfill of every task `uid` owns into their Google Tasks -
 * mirrors pushAllExistingItems in ./sync.ts. Called right after connecting
 * and from the manual "Sync now" action. Safe to call repeatedly. */
export async function pushAllExistingTasks(uid: string, workspaceId: string): Promise<void> {
  const tasksSnap = await getAdminFirestore()
    .collection(`workspaces/${workspaceId}/tasks`)
    .where("ownerId", "==", uid)
    .get();
  // Kept low deliberately - see withGoogleRetry's docstring in ./client.ts.
  await mapWithConcurrency(tasksSnap.docs, 3, (doc) => pushTaskToGoogle(uid, workspaceId, doc.id));
}

// ------------------------------------------------------------------ pull --

/** Reverse map for a genuinely external edit to an already-linked task.
 * Unlike calendarEventPatchFromGoogle in ./sync.ts, this can safely
 * round-trip `notes` -> `description` (Google's `notes` isn't a lossy
 * composition the way an event's description is - fieldsForTask writes it
 * straight across, so reading it straight back is exactly as accurate).
 *
 * Status needs care: Google Tasks only has two states (needsAction/
 * completed), FounderOS has six. Blindly mapping needsAction back would
 * stomp a FounderOS-specific state like "in_progress" or "blocked" down to
 * nothing every time this runs. So status/completedAt are only touched at
 * the two edges that are actually unambiguous: Google says completed and
 * FounderOS didn't already consider it done (mark it completed), or Google
 * says needsAction and FounderOS had it marked done (un-complete it, back
 * to "not_started" - there's no way to know which of the other four states
 * it should return to, so this is a deliberate, reasonable default rather
 * than a guess at "the right one"). */
function taskPatchFromGoogle(gTask: tasks_v1.Schema$Task, currentStatus: TaskStatus): Partial<Task> {
  const patch: Partial<Task> = omitUndefined({
    title: gTask.title || "(untitled)",
    description: gTask.notes || undefined,
    dueDate: gTask.due ? new Date(gTask.due).getTime() : null,
  });
  const currentlyDone = currentStatus === "completed" || currentStatus === "cancelled";
  const googleDone = gTask.status === "completed";
  if (googleDone && !currentlyDone) {
    patch.status = "completed";
    patch.completedAt = gTask.completed ? new Date(gTask.completed).getTime() : Date.now();
  } else if (!googleDone && currentlyDone) {
    patch.status = "not_started";
    patch.completedAt = null;
  }
  return patch;
}

async function applyGoogleTask(uid: string, workspaceId: string, gTask: tasks_v1.Schema$Task): Promise<void> {
  if (!gTask.id) return;

  // The link doc is keyed by our own taskId, not Google's, so finding it
  // from a Google task needs a query rather than a direct doc read.
  const linksSnap = await getAdminFirestore()
    .collection(`workspaces/${workspaceId}/googleTaskLinks`)
    .where("uid", "==", uid)
    .where("googleTaskId", "==", gTask.id)
    .get();
  const linkDoc = linksSnap.docs[0];

  if (gTask.deleted) {
    if (!linkDoc) return; // never linked - nothing to do
    const { taskId } = linkDoc.data() as GoogleTaskLink;
    await getAdminFirestore()
      .doc(`workspaces/${workspaceId}/tasks/${taskId}`)
      .delete()
      .catch(() => {}); // already gone on the FounderOS side - fine
    await linkDoc.ref.delete();
    return;
  }

  // A task created directly in Google Tasks, not through us - can't be
  // imported (see the module docstring for why), and nothing to update.
  if (!linkDoc) return;

  const link = linkDoc.data() as GoogleTaskLink;
  if (link.lastPushedGoogleUpdated && link.lastPushedGoogleUpdated === gTask.updated) return; // our own echo

  const taskRef = getAdminFirestore().doc(`workspaces/${workspaceId}/tasks/${link.taskId}`);
  const taskSnap = await taskRef.get();
  if (!taskSnap.exists) {
    // The FounderOS task is gone but the link wasn't cleaned up (e.g. a
    // delete that happened before this integration existed, or a race) -
    // clear the stale link and stop.
    await linkDoc.ref.delete();
    return;
  }

  const patch = taskPatchFromGoogle(gTask, (taskSnap.data() as Task).status);
  await taskRef.update(patch);
  await linkDoc.ref.set(
    omitUndefined({
      lastPushedGoogleUpdated: gTask.updated,
      contentHash: hashOf(fieldsForTask({ ...(taskSnap.data() as Task), ...patch } as Task)),
      updatedAt: Date.now(),
    }),
    { merge: true }
  );
}

/** Pulls Google-side changes to already-linked tasks into Firestore for one
 * connection - called by the manual "Sync now" action and the reconcile
 * cron. There's no webhook for Google Tasks (see the module docstring), so
 * this is the only way pull happens; unlike Calendar, there's no
 * incremental sync token available either, so it's a full list of the
 * dedicated task list every time - fine at this app's scale. Never throws;
 * failures are recorded on the connection, same as pullChangesForConnection
 * in ./sync.ts. */
export async function pullTasksForConnection(uid: string, workspaceId: string): Promise<void> {
  const connection = await getConnection(uid);
  if (!connection) return;

  try {
    const tasksApi = tasksClientFor(connection);
    const tasklist = await ensureFounderosTaskList(tasksApi, connection);

    const googleTasks: tasks_v1.Schema$Task[] = [];
    let pageToken: string | undefined;
    for (;;) {
      const page = await withGoogleRetry(() =>
        tasksApi.tasks.list({
          tasklist,
          pageToken,
          showCompleted: true,
          showHidden: true,
          showDeleted: true,
          maxResults: 100,
        })
      );
      googleTasks.push(...(page.data.items ?? []));
      pageToken = page.data.nextPageToken ?? undefined;
      if (!pageToken) break;
    }

    // Isolated per-task for the same reason as the Calendar pull loop in
    // ./sync.ts - one bad task must never block the rest.
    await mapWithConcurrency(googleTasks, 3, async (gTask) => {
      try {
        await applyGoogleTask(uid, workspaceId, gTask);
      } catch (err) {
        console.error(`Failed to apply pulled Google task ${gTask.id} for ${uid} (skipping it):`, err);
      }
    });

    await markConnectionHealthy(uid);
  } catch (err) {
    console.error(`Failed to pull Google Tasks for ${uid}:`, err);
    await markConnectionError(uid, err);
  }
}

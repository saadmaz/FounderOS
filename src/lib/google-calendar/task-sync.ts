/**
 * Push-only sync: FounderOS Tasks -> a dedicated "FounderOS" Google Tasks
 * list (the "Tasks" panel inside Google Calendar) in each connected
 * member's account. Separate from src/lib/google-calendar/sync.ts (Calendar
 * events/meetings) because Google Tasks is a genuinely different API with
 * its own OAuth scope - see ./oauth.ts.
 *
 * One-way and single-owner by design, unlike the Calendar side:
 * - No pull direction. Nobody asked for Google Tasks -> FounderOS, and the
 *   Tasks API doesn't support push notifications the way Calendar does
 *   anyway, so there's no cheap way to know something changed there.
 * - A task fans out to its `ownerId` only, not every connected workspace
 *   member (mirrors how a Meeting only pushes to its attendees, not the
 *   whole workspace - see pushToRelevantUsers in ./sync.ts). A task with no
 *   owner, or whose owner isn't connected, simply doesn't sync anywhere.
 *
 * A dedicated task list (rather than the account's default "My Tasks")
 * keeps FounderOS-originated tasks visually separate from personal to-dos,
 * the same reasoning the Calendar side used to apply before it was pointed
 * at the primary calendar on request - that request was specifically about
 * pulling in *existing* calendar history, which doesn't apply here since
 * this is push-only.
 */
import "server-only";
import type { tasks_v1 } from "@googleapis/tasks";
import { getAdminFirestore } from "@/lib/firebase/admin";
import type { GoogleCalendarConnection, GoogleTaskLink, Task } from "@/lib/types";
import { getConnection, markConnectionError, markConnectionHealthy, tasksClientFor } from "./client";
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
      await tasksApi.tasklists.get({ tasklist: connection.taskListId });
      return connection.taskListId;
    } catch {
      // Deleted on the Google side (or never existed) - fall through and
      // create a fresh one below.
    }
  }
  const created = await tasksApi.tasklists.insert({ requestBody: { title: FOUNDEROS_TASKLIST_TITLE } });
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
        result = (await tasksApi.tasks.patch({ tasklist, task: link.googleTaskId, requestBody: fields })).data;
      } catch (err) {
        if (!isGoogleNotFound(err)) throw err;
        result = null; // deleted on the Google side - fall through and re-insert
      }
    }
    if (!result) {
      result = (await tasksApi.tasks.insert({ tasklist, requestBody: fields })).data;
    }
    if (!result.id) throw new Error("Google didn't return a task id.");

    await linkRef.set(
      omitUndefined({
        uid,
        workspaceId,
        taskId,
        googleTaskId: result.id,
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
      await tasksApi.tasks.delete({ tasklist: connection.taskListId, task: link.googleTaskId });
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
  await mapWithConcurrency(tasksSnap.docs, 6, (doc) => pushTaskToGoogle(uid, workspaceId, doc.id));
}

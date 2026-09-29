/**
 * Single entry point for "do a complete sync for this connection," used by
 * every caller that wants one: the OAuth callback, the manual "Sync now"
 * action, and the reconcile cron. Runs all four steps strictly
 * sequentially and behind a lock (see acquireSyncLock in ./client.ts).
 *
 * This replaced firing the four steps as separate, parallel after() calls
 * from both the callback and sync-now routes. That was fine for a single
 * click, but nothing stopped a second click (or the cron landing mid-sync)
 * from starting another four in parallel with the first - the combined
 * concurrent request rate across pull calendar + pull tasks + push
 * calendar + push tasks was what actually tripped Calendar's "queries per
 * minute per user" quota, not any single step on its own, so per-call
 * retry/backoff and low per-loop concurrency alone couldn't fix it.
 */
import "server-only";
import { acquireSyncLock, releaseSyncLock } from "./client";
import { pullChangesForConnection, pushAllExistingItems } from "./sync";
import { pullTasksForConnection, pushAllExistingTasks } from "./task-sync";

export async function runFullSync(uid: string, workspaceId: string): Promise<void> {
  const acquired = await acquireSyncLock(uid);
  if (!acquired) return; // a sync is already running for this connection - let it finish, don't pile on

  try {
    await pullChangesForConnection(uid);
    await pullTasksForConnection(uid, workspaceId);
    await pushAllExistingItems(uid, workspaceId);
    await pushAllExistingTasks(uid, workspaceId);
  } finally {
    await releaseSyncLock(uid);
  }
}

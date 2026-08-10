/**
 * Read-only: scans every workspace's expenses/revenue/invoices/investments
 * and reports ones whose totals match a target (used to find "which
 * workspace is this screenshot's Overview tab showing" without needing the
 * user's login email). Writes nothing.
 */
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
const db = getFirestore();

const TARGET_EXPENSES = 3700;

const workspacesSnap = await db.collection("workspaces").get();
console.log(`Scanning ${workspacesSnap.size} workspaces for total (non-rejected) expenses = ${TARGET_EXPENSES}...\n`);

for (const wsDoc of workspacesSnap.docs) {
  const expensesSnap = await db.collection(`workspaces/${wsDoc.id}/expenses`).get();
  if (expensesSnap.empty) continue;

  const total = expensesSnap.docs
    .map((d) => d.data())
    .filter((e) => e.status !== "rejected")
    .reduce((sum, e) => sum + (e.amount ?? 0), 0);

  if (total === TARGET_EXPENSES) {
    console.log(`MATCH: workspace ${wsDoc.id} ("${wsDoc.data().name}") - total non-rejected expenses = ${total}`);
    for (const d of expensesSnap.docs) {
      const e = d.data();
      console.log(`  expense ${d.id}: "${e.title ?? e.description ?? "(untitled)"}" ${e.amount} ${e.currency} status=${e.status}`);
    }
    const companiesSnap = await db.collection(`workspaces/${wsDoc.id}/companies`).get();
    for (const c of companiesSnap.docs) {
      console.log(`  company ${c.id}: "${c.data().name}" currency=${c.data().currency}`);
    }
  } else {
    console.log(`  workspace ${wsDoc.id} ("${wsDoc.data().name}"): ${expensesSnap.size} expense(s), total ${total} - not a match`);
  }
}

console.log("\nDone (read-only, nothing was changed).");

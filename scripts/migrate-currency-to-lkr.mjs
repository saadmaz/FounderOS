/**
 * One-time data fix: the app used to default every new company/expense/
 * revenue/invoice/budget/investment record to currency "USD" - it now
 * defaults to "LKR" (see src/lib/format.ts, company-form-dialog.tsx, and
 * the finance form dialogs), but that only affects *new* records. This
 * walks every workspace in the real Firestore project (not the emulator)
 * and switches every existing company and finance record's `currency`
 * field to "LKR", so historical data matches the new default too.
 *
 * A company/record whose currency is already something other than "USD"
 * (i.e. was explicitly set) is left untouched - this only rewrites the
 * ones sitting on the old default.
 *
 * Run with:  node --env-file=.env.local scripts/migrate-currency-to-lkr.mjs
 */
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

if (!projectId || !clientEmail || !privateKey) {
  console.error(
    "Missing FIREBASE_ADMIN_PROJECT_ID / FIREBASE_ADMIN_CLIENT_EMAIL / FIREBASE_ADMIN_PRIVATE_KEY.\n" +
      "Run with: node --env-file=.env.local scripts/migrate-currency-to-lkr.mjs"
  );
  process.exit(1);
}

initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
const db = getFirestore();

const TARGET = "LKR";
const FINANCE_COLLECTIONS = ["expenses", "revenue", "invoices", "budgets", "investments"];

/** Updates every doc in `collectionRef` whose `currency` isn't already
 * TARGET, batched in chunks of 400 (Firestore's limit is 500 writes/batch). */
async function migrateCollection(collectionRef, label) {
  const snap = await collectionRef.get();
  const stale = snap.docs.filter((doc) => doc.data().currency !== TARGET);
  if (stale.length === 0) {
    console.log(`  ${label}: 0 to update (${snap.size} total)`);
    return 0;
  }

  for (let i = 0; i < stale.length; i += 400) {
    const batch = db.batch();
    for (const doc of stale.slice(i, i + 400)) {
      batch.update(doc.ref, { currency: TARGET });
    }
    await batch.commit();
  }

  console.log(`  ${label}: updated ${stale.length} of ${snap.size} (was: ${summarizeFrom(stale)})`);
  return stale.length;
}

function summarizeFrom(docs) {
  const counts = new Map();
  for (const doc of docs) {
    const cur = doc.data().currency ?? "(none)";
    counts.set(cur, (counts.get(cur) ?? 0) + 1);
  }
  return [...counts.entries()].map(([cur, n]) => `${cur}×${n}`).join(", ");
}

async function main() {
  const workspacesSnap = await db.collection("workspaces").get();
  if (workspacesSnap.empty) {
    console.log("No workspaces found.");
    return;
  }

  let grandTotal = 0;
  for (const workspaceDoc of workspacesSnap.docs) {
    const workspace = workspaceDoc.data();
    console.log(`\nWorkspace ${workspaceDoc.id} (${workspace.name ?? "unnamed"}):`);

    grandTotal += await migrateCollection(workspaceDoc.ref.collection("companies"), "companies");
    for (const name of FINANCE_COLLECTIONS) {
      grandTotal += await migrateCollection(workspaceDoc.ref.collection(name), name);
    }
  }

  console.log(`\nDone - ${grandTotal} document(s) switched to ${TARGET}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

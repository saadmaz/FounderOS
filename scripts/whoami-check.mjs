/**
 * Read-only diagnostic: finds the workspace(s) actually tied to a given
 * account email via Auth -> userWorkspaces, and reports each one's
 * companies/currency without writing anything.
 */
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
const auth = getAuth();
const db = getFirestore();

const email = process.argv[2];
if (!email) {
  console.error("Usage: node --env-file=.env.local scripts/whoami-check.mjs <email>");
  process.exit(1);
}

const user = await auth.getUserByEmail(email);
console.log(`Auth user: ${user.uid} <${user.email}>`);

const mapping = await db.doc(`userWorkspaces/${user.uid}`).get();
console.log(`userWorkspaces/${user.uid}:`, mapping.exists ? mapping.data() : "(missing)");

// Also check membership docs directly, in case userWorkspaces is stale/partial.
const workspacesSnap = await db.collection("workspaces").get();
for (const wsDoc of workspacesSnap.docs) {
  const memberDoc = await db.doc(`workspaces/${wsDoc.id}/members/${user.uid}`).get();
  if (!memberDoc.exists) continue;
  console.log(`\nMember of workspace ${wsDoc.id} (${wsDoc.data().name}), role: ${memberDoc.data().role}`);
  const companiesSnap = await db.collection(`workspaces/${wsDoc.id}/companies`).get();
  for (const c of companiesSnap.docs) {
    console.log(`  company ${c.id}: "${c.data().name}" currency=${c.data().currency}`);
  }
  const expensesSnap = await db.collection(`workspaces/${wsDoc.id}/expenses`).get();
  console.log(`  expenses: ${expensesSnap.size}`);
}

/**
 * Reverts the unintended part of migrate-currency-to-lkr.mjs's first run:
 * it swept every workspace in this (shared, multi-tenant) Firestore project
 * before that was noticed, and flipped one company's currency from USD to
 * LKR in each of the 9 workspaces below - none of which belong to this
 * session's actual user. This sets exactly those 9 companies back to USD
 * and touches nothing else.
 *
 * Run with:  node --env-file=.env.local scripts/revert-currency-migration.mjs
 */
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
const db = getFirestore();

const WORKSPACE_IDS = [
  "0JtuMq96ENczHKXdX8kK",
  "8K6qK2tsRbWmnyPlIosd",
  "8q7jgiKgwydzEN5MIxZK",
  "BxFANZE4YdsT8eP8WPeG",
  "GUdeJiPjzAiIQH9l3RnY",
  "JNtdTuFQpyeFnZSowe7L",
  "Ms49ILH7nJcr9xNCvZfv",
  "T9qA39e0Ehbm2wXzZtmu",
  "WFZtng71BKBMWsQTVdZX",
];

let reverted = 0;
for (const workspaceId of WORKSPACE_IDS) {
  const companiesSnap = await db.collection(`workspaces/${workspaceId}/companies`).get();
  for (const doc of companiesSnap.docs) {
    const data = doc.data();
    if (data.currency === "LKR") {
      await doc.ref.update({ currency: "USD" });
      console.log(`Reverted workspaces/${workspaceId}/companies/${doc.id} ("${data.name}") LKR -> USD`);
      reverted++;
    } else {
      console.log(`Skipped workspaces/${workspaceId}/companies/${doc.id} - currency is "${data.currency}", not LKR`);
    }
  }
}
console.log(`\nDone - reverted ${reverted} compan${reverted === 1 ? "y" : "ies"}.`);

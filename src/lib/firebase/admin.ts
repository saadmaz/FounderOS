/**
 * Firebase Admin SDK, server-only. This must never be imported from a
 * "use client" module - it holds a service account private key and talks
 * to Firebase with full admin privileges, unlike src/lib/firebase/client.ts.
 * It's only ever imported from Route Handlers (src/app/api/**), which run
 * server-side, so it naturally never reaches the client bundle.
 *
 * Used to generate action links (password reset, email verification) for
 * emails we send ourselves via Resend, instead of Firebase Auth's own
 * built-in email sender - see src/lib/email/. getAdminFirestore() is the one
 * exception to this app's otherwise client-SDK-first Firestore access: it's
 * used solely by src/app/api/workspace/accept-invite, which needs to write a
 * new member doc for a user Firestore rules can't yet authorize by any
 * lookup path (see that route for why).
 *
 * Initialization is lazy (on first call to getAdminAuth/getAdminFirestore),
 * not at module load, so importing this file doesn't crash routes that don't
 * actually need it before the service account env vars are configured.
 */
import "server-only";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

let app: App | undefined;

function getAdminApp(): App {
  if (app) return app;
  if (getApps().length) {
    app = getApps()[0];
    return app;
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Firebase Admin isn't configured - set FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, " +
        "and FIREBASE_ADMIN_PRIVATE_KEY (from Firebase Console > Project Settings > Service Accounts > " +
        "Generate new private key)."
    );
  }

  app = initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  return app;
}

export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}

export function getAdminFirestore(): Firestore {
  return getFirestore(getAdminApp());
}

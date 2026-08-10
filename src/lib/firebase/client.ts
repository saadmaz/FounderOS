"use client";

import { type FirebaseApp, getApps, initializeApp } from "firebase/app";
import { type Analytics, isSupported as isAnalyticsSupported, getAnalytics } from "firebase/analytics";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectStorageEmulator, getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

function createFirebaseApp(): FirebaseApp {
  return getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
}

export const app = createFirebaseApp();
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Analytics only works in the browser and only on environments it supports
// (no IndexedDB, some webviews, etc. fail the check) - never call getAnalytics
// during SSR/build, that's what broke the Vercel build for auth/firestore
// before env vars were configured.
//
// analyticsReady is a promise (not a plain nullable value) on purpose: code
// that fires early - sign_up/login on the very first page load, for example
// - would otherwise race the async isSupported() check below and read
// analytics as still-null, silently dropping the event. Awaiting this
// promise instead makes every caller wait for the real answer.
// Analytics/Installations always call the real Firebase backend - there's no
// local emulator for them - so under the emulator they just fail every
// request (Installations 403s, retried repeatedly) and spam the console
// without ever collecting anything real. Skip entirely in that mode.
export const analyticsReady: Promise<Analytics | null> =
  typeof window !== "undefined" &&
  firebaseConfig.measurementId &&
  process.env.NEXT_PUBLIC_USE_EMULATOR !== "true"
    ? isAnalyticsSupported()
        .then((supported) => (supported ? getAnalytics(app) : null))
        .catch(() => null)
    : Promise.resolve(null);

// Connect to the Local Emulator Suite exactly once, in the browser only.
// Guarded by a global flag because Fast Refresh re-runs this module.
declare global {
  var __founderosEmulatorsConnected: boolean | undefined;
}

if (
  typeof window !== "undefined" &&
  process.env.NEXT_PUBLIC_USE_EMULATOR === "true" &&
  !globalThis.__founderosEmulatorsConnected
) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectStorageEmulator(storage, "127.0.0.1", 9199);
  globalThis.__founderosEmulatorsConnected = true;
}

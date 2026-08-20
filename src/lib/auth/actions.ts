"use client";

import {
  EmailAuthProvider,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updatePassword,
  updateProfile,
} from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { trackEvent } from "@/lib/analytics";
import { auth, db, storage } from "@/lib/firebase/client";

export async function signUpWithEmail(name: string, email: string, password: string) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if (name) {
    await updateProfile(cred.user, { displayName: name });
  }
  trackEvent("sign_up", { method: "password" });
  // Best-effort: a hiccup sending the verification email shouldn't block
  // account creation - the user can still use the app unverified.
  sendVerificationEmail(cred.user).catch(() => {});
  return cred.user;
}

/** Sends our own branded "confirm your email" message (see
 * src/app/api/auth/send-verification) instead of Firebase's built-in one. */
export async function sendVerificationEmail(user: { getIdToken: () => Promise<string> }) {
  const idToken = await user.getIdToken();
  const res = await fetch("/api/auth/send-verification", {
    method: "POST",
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!res.ok) {
    throw new Error(`Failed to send verification email (${res.status})`);
  }
}

export async function signInWithEmail(email: string, password: string) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  trackEvent("login", { method: "password" });
  return cred.user;
}

export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  const cred = await signInWithPopup(auth, provider);
  trackEvent("login", { method: "google" });
  return cred.user;
}

export async function signOut() {
  await firebaseSignOut(auth);
}

/**
 * Sends our own branded password-reset email (see
 * src/app/api/auth/reset-password) instead of Firebase Auth's built-in one -
 * Firebase's Console template editor can't produce a real styled button, so
 * the link is generated via Firebase Admin and delivered through Resend.
 * Always resolves, even for an unknown email - the API route intentionally
 * doesn't reveal whether the account exists.
 */
export async function resetPassword(email: string) {
  const res = await fetch("/api/auth/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    throw new Error(`Failed to send reset email (${res.status})`);
  }
  trackEvent("password_reset_requested");
}

/**
 * Uploads a new avatar, updates the Auth profile, and mirrors the change
 * onto the workspace member doc - the member doc (not the Auth user) is
 * what other members' UIs actually read (see src/lib/data/members.ts).
 */
export async function updateUserProfile(
  workspaceId: string,
  patch: { displayName?: string; photoFile?: File }
) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in");

  let photoURL = user.photoURL ?? undefined;
  if (patch.photoFile) {
    const ext = patch.photoFile.name.split(".").pop() ?? "jpg";
    const path = `workspaces/${workspaceId}/avatars/${user.uid}-${Date.now()}.${ext}`;
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, patch.photoFile);
    photoURL = await getDownloadURL(storageRef);
  }

  const displayName = patch.displayName?.trim() || user.displayName || undefined;

  await updateProfile(user, { displayName, photoURL });
  await updateDoc(doc(db, "workspaces", workspaceId, "members", user.uid), {
    ...(displayName ? { displayName } : {}),
    ...(photoURL ? { photoURL } : {}),
  });
}

/** Sends the invite email for an invite doc already created client-side
 * (see src/lib/data/invites.ts) - see src/app/api/workspace/invite for why
 * this needs a server route rather than sending straight from the client. */
export async function sendInviteEmail(inviteId: string) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in");
  const idToken = await user.getIdToken();
  const res = await fetch("/api/workspace/invite", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ inviteId }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `Failed to send invite email (${res.status})`);
  }
}

/** Accepts an invite: writes the new member doc and moves the caller's
 * workspace pointer, both server-side via Firebase Admin - see
 * src/app/api/workspace/accept-invite for why Firestore rules alone can't
 * authorize this write. */
export async function acceptInvite(inviteId: string) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in");
  const idToken = await user.getIdToken();
  const res = await fetch("/api/workspace/accept-invite", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ inviteId }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(body?.error ?? `Failed to accept invite (${res.status})`);
  }
  return body as { ok: true; workspaceId: string };
}

export async function changeUserPassword(currentPassword: string, newPassword: string) {
  const user = auth.currentUser;
  if (!user?.email) throw new Error("Not signed in");
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  await updatePassword(user, newPassword);
}

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
  return cred.user;
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

export async function changeUserPassword(currentPassword: string, newPassword: string) {
  const user = auth.currentUser;
  if (!user?.email) throw new Error("Not signed in");
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  await updatePassword(user, newPassword);
}

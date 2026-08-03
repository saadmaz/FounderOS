const MESSAGES: Record<string, string> = {
  "auth/email-already-in-use": "An account with that email already exists.",
  "auth/invalid-email": "That email address doesn't look right.",
  "auth/invalid-credential": "Incorrect email or password.",
  "auth/wrong-password": "Incorrect email or password.",
  "auth/user-not-found": "No account found with that email.",
  "auth/weak-password": "Use at least 6 characters.",
  "auth/popup-closed-by-user": "Sign-in was cancelled.",
  "auth/too-many-requests": "Too many attempts. Try again in a moment.",
  "auth/requires-recent-login": "For security, please sign out and back in before changing your password.",
};

export function authErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code;
  if (code && MESSAGES[code]) return MESSAGES[code];
  return "Something went wrong. Please try again.";
}

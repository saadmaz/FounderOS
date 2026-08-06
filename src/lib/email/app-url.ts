/** Absolute base URL used to build Firebase action links (password reset,
 * email verification, ...) that point back at this app's own branded
 * /auth/action page instead of Firebase's generic hosted one. */
export function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

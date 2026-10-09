/**
 * Shared request-auth helpers for Route Handlers (src/app/api/**). Every
 * authenticated route needs the same three steps - pull the Bearer ID
 * token, verify it, look up the caller's workspace role - and having each
 * route hand-roll them is how one ends up missing a check entirely. The
 * role groups below mirror the helper functions in firestore.rules
 * (canContribute, canManage, canManageFinance) and must stay in sync.
 */
import "server-only";
import type { DecodedIdToken } from "firebase-admin/auth";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebase/admin";
import type { Role } from "@/lib/types";

export const CONTRIBUTOR_ROLES: readonly Role[] = ["owner", "admin", "manager", "employee", "accountant"];
export const MANAGER_ROLES: readonly Role[] = ["owner", "admin", "manager"];
export const FINANCE_ROLES: readonly Role[] = ["owner", "admin", "accountant"];

/** Roles an invite may grant - never "owner" (no owner transfer). */
export const INVITABLE_ROLES: readonly Role[] = ["admin", "manager", "employee", "accountant", "viewer"];

/** Verifies the request's `Authorization: Bearer <idToken>` header. Returns
 * null for a missing or invalid token rather than throwing, so callers can
 * answer with a plain 401. */
export async function verifyRequestUser(request: Request): Promise<DecodedIdToken | null> {
  const authHeader = request.headers.get("authorization") ?? "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;
  if (!idToken) return null;
  try {
    return await getAdminAuth().verifyIdToken(idToken);
  } catch {
    return null;
  }
}

/** The caller's role in a workspace, or null if they aren't a member. */
export async function getMemberRole(workspaceId: string, uid: string): Promise<Role | null> {
  const snap = await getAdminFirestore().doc(`workspaces/${workspaceId}/members/${uid}`).get();
  return snap.exists ? ((snap.data()?.role as Role | undefined) ?? null) : null;
}

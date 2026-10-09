/**
 * Server-side half of src/lib/cloudinary.ts - the only place the Cloudinary
 * API secret is used. Every asset lives under
 * `founderos/{workspaceId}/{kind}/...`, so the folder itself says which
 * workspace an asset belongs to and which Firestore collection's write
 * rule governs it. Both signing an upload and deleting an asset check the
 * caller's role against that same mapping, so a member can only touch
 * assets they could already create/delete the owning record for.
 */
import "server-only";
import { v2 as cloudinary } from "cloudinary";
import { CONTRIBUTOR_ROLES, FINANCE_ROLES, MANAGER_ROLES } from "@/lib/auth/server";
import type { Role } from "@/lib/types";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export { cloudinary };

/** Mirrors firestore.rules: documents -> canContribute, receipts and
 * investment documents -> canManageFinance, company logos -> canManage. */
const FOLDER_ROLES: Record<string, readonly Role[]> = {
  documents: CONTRIBUTOR_ROLES,
  receipts: FINANCE_ROLES,
  "investment-documents": FINANCE_ROLES,
  logos: MANAGER_ROLES,
};

/** Parses `founderos/{workspaceId}/{kind}` (a folder) or
 * `founderos/{workspaceId}/{kind}/...` (a public id). Returns null for
 * anything outside that shape or for an unknown kind. */
export function parseAssetPath(path: string): { workspaceId: string; allowedRoles: readonly Role[] } | null {
  const [root, workspaceId, kind] = path.split("/");
  if (root !== "founderos" || !workspaceId || !kind) return null;
  const allowedRoles = FOLDER_ROLES[kind];
  return allowedRoles ? { workspaceId, allowedRoles } : null;
}

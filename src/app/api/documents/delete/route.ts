import { NextResponse } from "next/server";
import { getMemberRole, verifyRequestUser } from "@/lib/auth/server";
import { cloudinary, parseAssetPath } from "@/lib/cloudinary-server";

// firebase-admin needs Node's crypto/fs/net at import time - see
// reset-password/route.ts for the full explanation.
export const runtime = "nodejs";

const VALID_RESOURCE_TYPES = ["image", "video", "raw"] as const;
type ResourceType = (typeof VALID_RESOURCE_TYPES)[number];

/**
 * Deletes a Cloudinary asset. Deleting needs the API secret, so it can only
 * happen here, server-side. A publicId isn't a secret (it's embedded in the
 * asset's public URL), so knowing one proves nothing - the caller must be a
 * signed-in member of the workspace the asset's folder names, with a role
 * that could delete the record it's attached to (see parseAssetPath).
 */
export async function POST(request: Request) {
  const decoded = await verifyRequestUser(request);
  if (!decoded) {
    return NextResponse.json({ error: "Missing or invalid auth token" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const publicId = body?.publicId;
  const resourceType = body?.resourceType as ResourceType | undefined;

  const asset = typeof publicId === "string" ? parseAssetPath(publicId) : null;
  if (!asset) {
    return NextResponse.json({ error: "Invalid publicId" }, { status: 400 });
  }
  if (!resourceType || !VALID_RESOURCE_TYPES.includes(resourceType)) {
    return NextResponse.json({ error: "Invalid resourceType" }, { status: 400 });
  }

  const role = await getMemberRole(asset.workspaceId, decoded.uid);
  if (!role || !asset.allowedRoles.includes(role)) {
    return NextResponse.json({ error: "Not allowed to delete this file" }, { status: 403 });
  }

  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Cloudinary delete failed" }, { status: 502 });
  }
}

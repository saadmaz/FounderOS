import { NextResponse } from "next/server";
import { getMemberRole, verifyRequestUser } from "@/lib/auth/server";
import { cloudinary, parseAssetPath } from "@/lib/cloudinary-server";

// firebase-admin needs Node's crypto/fs/net at import time - see
// reset-password/route.ts for the full explanation.
export const runtime = "nodejs";

/**
 * Signs a direct-from-browser Cloudinary upload. With unsigned presets,
 * anyone who knows the cloud name + preset name (both ship in the client
 * bundle) can upload to this account; signing means only a signed-in
 * member with the right role for the target folder can. The browser still
 * uploads straight to Cloudinary - only the signature comes from here.
 *
 * The presets themselves must be switched to "Signed" in the Cloudinary
 * dashboard for this to actually close the unsigned path.
 */
export async function POST(request: Request) {
  const decoded = await verifyRequestUser(request);
  if (!decoded) {
    return NextResponse.json({ error: "Missing or invalid auth token" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const folder = typeof body?.folder === "string" ? body.folder : null;
  const kind = body?.kind === "image" || body?.kind === "raw" ? body.kind : null;
  const asset = folder ? parseAssetPath(folder) : null;
  if (!folder || !kind || !asset || folder.split("/").length !== 3) {
    return NextResponse.json({ error: "Invalid folder or kind" }, { status: 400 });
  }

  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  const uploadPreset =
    kind === "image"
      ? process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET
      : process.env.NEXT_PUBLIC_CLOUDINARY_DOCS_UPLOAD_PRESET;
  if (!apiKey || !apiSecret || !uploadPreset) {
    return NextResponse.json({ error: "Cloudinary isn't configured on this deployment" }, { status: 503 });
  }

  const role = await getMemberRole(asset.workspaceId, decoded.uid);
  if (!role || !asset.allowedRoles.includes(role)) {
    return NextResponse.json({ error: "Not allowed to upload here" }, { status: 403 });
  }

  const timestamp = Math.round(Date.now() / 1000);
  const signature = cloudinary.utils.api_sign_request(
    { folder, timestamp, upload_preset: uploadPreset },
    apiSecret
  );
  return NextResponse.json({ signature, timestamp, apiKey, uploadPreset, folder });
}

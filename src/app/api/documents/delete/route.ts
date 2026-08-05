import { v2 as cloudinary } from "cloudinary";
import { NextResponse } from "next/server";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const VALID_RESOURCE_TYPES = ["image", "video", "raw"] as const;
type ResourceType = (typeof VALID_RESOURCE_TYPES)[number];

/**
 * Deletes a Cloudinary asset. Unsigned upload presets can create assets from
 * the browser but can never delete them (that needs the API secret, which
 * must stay server-side) - this route is the one place that secret is used.
 *
 * There's no per-user auth check here, only a folder-prefix allowlist: a
 * publicId is an opaque, unguessable string that's only ever exposed to
 * workspace members via Firestore (itself rules-protected), so knowing one
 * is treated as authorization to delete it - the same trust model the
 * unsigned upload preset already relies on for creates.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const publicId = body?.publicId;
  const resourceType = body?.resourceType as ResourceType | undefined;

  if (typeof publicId !== "string" || !publicId.startsWith("founderos/")) {
    return NextResponse.json({ error: "Invalid publicId" }, { status: 400 });
  }
  if (!resourceType || !VALID_RESOURCE_TYPES.includes(resourceType)) {
    return NextResponse.json({ error: "Invalid resourceType" }, { status: 400 });
  }

  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Cloudinary delete failed" }, { status: 502 });
  }
}

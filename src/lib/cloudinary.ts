/**
 * Direct-from-browser uploads via Cloudinary unsigned upload presets - no
 * server route, no IAM/security-rule cross-service dependency (unlike
 * Firebase Storage, see workspace.ts history). The preset itself is the
 * access boundary: configure allowed formats/max file size on it in the
 * Cloudinary dashboard rather than trusting the client.
 */

async function uploadToCloudinary(
  file: File,
  opts: { preset: string; endpoint: "image" | "auto"; folder?: string }
): Promise<{ url: string; publicId: string; resourceType: string }> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  if (!cloudName) {
    throw new Error("Cloudinary isn't configured - set NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME.");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", opts.preset);
  if (opts.folder) formData.append("folder", opts.folder);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${opts.endpoint}/upload`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? `Cloudinary upload failed (${res.status})`);
  }
  const data = (await res.json()) as { secure_url: string; public_id: string; resource_type: string };
  return { url: data.secure_url, publicId: data.public_id, resourceType: data.resource_type };
}

/** Company logos - image-only preset. */
export async function uploadImageToCloudinary(file: File, folder?: string): Promise<string> {
  const preset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
  if (!preset) {
    throw new Error("Cloudinary isn't configured - set NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET.");
  }
  const { url } = await uploadToCloudinary(file, { preset, endpoint: "image", folder });
  return url;
}

/**
 * Documents - any file type (PDF, Office docs, zips, images, ...), via a
 * separate preset so its format/size limits can differ from the logo one.
 * `resource_type: auto` lets Cloudinary route the file to its image/video/raw
 * bucket; the caller needs `resourceType` back to delete it later, since
 * Cloudinary's destroy API is scoped per resource type.
 */
export async function uploadDocumentToCloudinary(file: File, folder?: string) {
  const preset = process.env.NEXT_PUBLIC_CLOUDINARY_DOCS_UPLOAD_PRESET;
  if (!preset) {
    throw new Error("Cloudinary isn't configured - set NEXT_PUBLIC_CLOUDINARY_DOCS_UPLOAD_PRESET.");
  }
  return uploadToCloudinary(file, { preset, endpoint: "auto", folder });
}

/**
 * Deletes a previously-uploaded Cloudinary asset via the server route (that's
 * the one place the API secret can be used - see src/app/api/documents/delete).
 * Throws on failure; it's up to the caller whether that should block their
 * own delete. Documents let it throw (the file *is* the record); Expense/
 * Invoice attachments are best-effort, so a Cloudinary hiccup never strands
 * someone from deleting the underlying financial record.
 */
export async function deleteCloudinaryAsset(publicId: string, resourceType: string) {
  const res = await fetch("/api/documents/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ publicId, resourceType }),
  });
  if (!res.ok) {
    throw new Error(`Failed to delete Cloudinary asset (${res.status})`);
  }
}

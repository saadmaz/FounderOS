import { auth } from "@/lib/firebase/client";

/**
 * Direct-from-browser uploads to Cloudinary. Each upload is signed first by
 * src/app/api/cloudinary/sign, which checks the caller's workspace role for
 * the target folder - the file itself never passes through our server, only
 * the signature does. Format/max-size limits still live on the presets in
 * the Cloudinary dashboard (which must be set to "Signed" mode).
 */

async function authedJson<T>(url: string, body: unknown): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in");
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status})`);
  return data as T;
}

async function uploadToCloudinary(
  file: File,
  opts: { endpoint: "image" | "raw"; folder: string }
): Promise<{ url: string; publicId: string; resourceType: string }> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  if (!cloudName) {
    throw new Error("Cloudinary isn't configured - set NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME.");
  }

  const signed = await authedJson<{
    signature: string;
    timestamp: number;
    apiKey: string;
    uploadPreset: string;
    folder: string;
  }>("/api/cloudinary/sign", { folder: opts.folder, kind: opts.endpoint });

  const formData = new FormData();
  formData.append("file", file);
  formData.append("api_key", signed.apiKey);
  formData.append("timestamp", String(signed.timestamp));
  formData.append("signature", signed.signature);
  formData.append("upload_preset", signed.uploadPreset);
  formData.append("folder", signed.folder);

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

/** Company logos - image-only preset. `folder` is
 * `founderos/{workspaceId}/logos`. */
export async function uploadImageToCloudinary(file: File, folder: string): Promise<string> {
  const { url } = await uploadToCloudinary(file, { endpoint: "image", folder });
  return url;
}

/**
 * Documents - any file type (PDF, Office docs, zips, images, ...), via a
 * separate preset so its format/size limits can differ from the logo one.
 * Always uploaded as `resource_type: raw` rather than `auto` - "auto" lets
 * Cloudinary route the file into its image/video/raw buckets based on its
 * own content sniffing, and PDFs land in the "image" bucket, where
 * Cloudinary can reprocess/re-derive the asset's format (observed turning
 * some PDFs into a stored ".ai" asset - AI files are themselves valid PDFs
 * under the hood, so the sniffing isn't reliable). `raw` stores the exact
 * bytes with the exact original extension, no reinterpretation - the file
 * that downloads is always the file that was uploaded. The caller needs
 * `resourceType` back to delete it later, since Cloudinary's destroy API is
 * scoped per resource type.
 */
export async function uploadDocumentToCloudinary(file: File, folder: string) {
  return uploadToCloudinary(file, { endpoint: "raw", folder });
}

/**
 * Deletes a previously-uploaded Cloudinary asset via the server route (that's
 * the one place the API secret can be used - see src/app/api/documents/delete).
 * Throws on failure; it's up to the caller whether that should block their
 * own delete. Documents let it throw (the file *is* the record); Expense
 * receipts are best-effort, so a Cloudinary hiccup never strands someone
 * from deleting the underlying expense record.
 */
export async function deleteCloudinaryAsset(publicId: string, resourceType: string) {
  await authedJson("/api/documents/delete", { publicId, resourceType });
}

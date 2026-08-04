/**
 * Direct-from-browser image uploads via a Cloudinary unsigned upload preset -
 * no server route, no IAM/security-rule cross-service dependency (unlike
 * Firebase Storage, see workspace.ts history). The preset itself is the
 * access boundary: configure allowed formats/max file size on it in the
 * Cloudinary dashboard rather than trusting the client.
 */
export async function uploadImageToCloudinary(file: File, folder?: string): Promise<string> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
  if (!cloudName || !uploadPreset) {
    throw new Error(
      "Cloudinary isn't configured - set NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME and NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET."
    );
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", uploadPreset);
  if (folder) formData.append("folder", folder);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? `Cloudinary upload failed (${res.status})`);
  }
  const data = (await res.json()) as { secure_url: string };
  return data.secure_url;
}

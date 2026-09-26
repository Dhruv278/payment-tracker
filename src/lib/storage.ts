import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "documents";
const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED = ["application/pdf", "image/png", "image/jpeg", "image/webp"];

/** Validates and uploads an optional file. Returns the storage path, null if no file was given, or an error. */
export async function uploadDocument(
  file: FormDataEntryValue | null,
  folder: string,
): Promise<{ path: string | null; error?: string }> {
  if (!(file instanceof File) || file.size === 0) return { path: null };
  if (file.size > MAX_BYTES) return { path: null, error: "File must be 4 MB or smaller." };
  if (!ALLOWED.includes(file.type)) return { path: null, error: "Only PDF, PNG, JPG or WEBP files are allowed." };

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
  const path = `${folder}/${Date.now()}-${safeName}`;
  const { error } = await createAdminClient()
    .storage.from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error) return { path: null, error: `Upload failed: ${error.message}` };
  return { path };
}

export async function removeDocuments(paths: (string | null | undefined)[]) {
  const list = paths.filter((p): p is string => Boolean(p));
  if (list.length) await createAdminClient().storage.from(BUCKET).remove(list);
}

/** Short-lived download URL. Call only after checking the viewer may see the file. */
export async function signedUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const { data } = await createAdminClient().storage.from(BUCKET).createSignedUrl(path, 60 * 10);
  return data?.signedUrl ?? null;
}

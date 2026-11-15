"use client";
import { createClient } from "@/lib/supabase/browser";
import { CONTENT_BUCKET, DIRECT_UPLOAD_MAX } from "./files";

/**
 * Puts the file in the form. Small files go in as `file`. Bigger ones (Vercel refuses bodies over about 4.5 MB) are uploaded
 * straight to Storage with a one-time signed URL, and the form carries only their path as `staged`.
 */
export async function attachFile(fd: FormData, file: File): Promise<void> {
  fd.delete("file");
  if (file.size <= DIRECT_UPLOAD_MAX) return fd.set("file", file);
  const res = await fetch("/api/upload-url", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: file.name, size: file.size }) });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof body.error === "string" ? body.error : "The file could not be uploaded.");
  const supabase = createClient();
  if (!supabase) throw new Error("Uploads are not set up on this server yet.");
  const { error } = await supabase.storage.from(CONTENT_BUCKET).uploadToSignedUrl(body.path, body.token, file, { contentType: file.type || "application/octet-stream" });
  if (error) throw new Error("The file could not be uploaded. Please try again.");
  fd.set("staged", body.path);
}

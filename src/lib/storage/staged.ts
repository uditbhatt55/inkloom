import { MAX_UPLOAD_BYTES, RequestError } from "@/lib/audit/request";
import type { Db } from "@/lib/supabase/server";
import { CONTENT_BUCKET, isStagedPathOf } from "./files";

/**
 * If the form names a staged upload (a file too big to send through Vercel, put in Storage by the browser first),
 * fetch it with the service role, delete it, and put it back in the form as `file`, so the route works as for a direct upload.
 */
export async function takeStagedFile(form: FormData, userId: string, service: Db): Promise<void> {
  const path = form.get("staged");
  form.delete("staged");
  if (typeof path !== "string" || path === "") return;
  if (!isStagedPathOf(userId, path)) throw new RequestError(400, "The upload could not be read.");
  const bucket = service.storage.from(CONTENT_BUCKET);
  const { data, error } = await bucket.download(path);
  await bucket.remove([path]).catch(() => undefined); // best effort: a left-over staged file is only storage, never shown
  if (error || !data) throw new RequestError(400, "The upload could not be read. Please upload it again.");
  if (data.size > MAX_UPLOAD_BYTES) throw new RequestError(413, "Files over 10 MB are not supported.");
  form.set("file", new File([data], path.slice(path.lastIndexOf("/") + 1)));
}

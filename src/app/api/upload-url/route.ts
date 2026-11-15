import { NextResponse, type NextRequest } from "next/server";
import { MAX_UPLOAD_BYTES } from "@/lib/audit/request";
import { CONTENT_BUCKET, stagedPath } from "@/lib/storage/files";
import { ConfigError, createServiceClient, createUserClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const fail = (status: number, error: string) => NextResponse.json({ error }, { status });

/**
 * POST /api/upload-url (JSON: name, size) → { path, token }: a one-time signed upload into the user's own staging folder,
 * for files bigger than Vercel lets through. The audit and import routes then take the file by path (src/lib/storage/staged.ts).
 * shortcut: a staged file that is never submitted stays in the bucket; add a cleanup job if storage use grows.
 */
export async function POST(req: NextRequest) {
  try {
    const db = await createUserClient();
    const { data: auth } = await db.auth.getUser();
    if (!auth.user) return fail(401, "Please sign in.");
    const body = await req.json().catch(() => null);
    const name = typeof body?.name === "string" ? body.name : "";
    const size = typeof body?.size === "number" ? body.size : 0;
    if (!name || size <= 0) return fail(400, "Choose a file to upload.");
    if (size > MAX_UPLOAD_BYTES) return fail(413, "Files over 10 MB are not supported.");

    const path = stagedPath(auth.user.id, crypto.randomUUID(), name);
    const { data, error } = await createServiceClient().storage.from(CONTENT_BUCKET).createSignedUploadUrl(path);
    if (error || !data) throw new Error(error?.message ?? "no signed url");
    return NextResponse.json({ path: data.path, token: data.token });
  } catch (e) {
    if (e instanceof ConfigError) return fail(503, "Uploads are not set up on this server yet.");
    console.error("upload-url failed:", e instanceof Error ? e.message : "unknown");
    return fail(500, "The file could not be uploaded. Please try again.");
  }
}

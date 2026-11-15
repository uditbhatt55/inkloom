import { NextResponse, type NextRequest } from "next/server";
import { MAX_UPLOAD_BYTES, RequestError } from "@/lib/audit/request";
import { chooseImporter, draftBrandBook } from "@/lib/knowledge/import-service";
import { ParseError, parseUpload } from "@/lib/parsers";
import { takeStagedFile } from "@/lib/storage/staged";
import { ConfigError, createServiceClient, createUserClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail = (status: number, error: string) => NextResponse.json({ error }, { status });

/**
 * POST /api/knowledge/import (multipart: orgId, file) — P2b brand-book import. Owner only. Parses the PDF/DOCX and
 * returns a DRAFT of guidelines, terms and colours for the owner to review. It writes nothing: accepted items are saved
 * by the owner's own session under RLS. shortcut: not counted by the audit usage cap (owner-only, rare); add it to the
 * cap if imports are opened to more roles.
 */
export async function POST(req: NextRequest) {
  try {
    if (Number(req.headers.get("content-length") ?? 0) > MAX_UPLOAD_BYTES + 64 * 1024) return fail(413, "Files over 10 MB are not supported.");
    const db = await createUserClient();
    const { data: auth } = await db.auth.getUser();
    if (!auth.user) return fail(401, "Please sign in.");

    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return fail(400, "The upload could not be read.");
    }
    const orgId = String(form.get("orgId") ?? "");
    if (!UUID.test(orgId)) return fail(400, "Choose a brand book to import.");
    const { data: member } = await db.from("memberships").select("role").eq("org_id", orgId).eq("user_id", auth.user.id).maybeSingle();
    if (member?.role !== "owner") return fail(403, "Only the brand owner can import a brand book.");
    await takeStagedFile(form, auth.user.id, createServiceClient());
    const file = form.get("file");
    if (!UUID.test(orgId) || !(file instanceof File) || file.size === 0) return fail(400, "Choose a brand book to import.");
    if (file.size > MAX_UPLOAD_BYTES) return fail(413, "Files over 10 MB are not supported.");

    const parsed = await parseUpload(new Uint8Array(await file.arrayBuffer()));
    if (parsed.kind !== "pdf" && parsed.kind !== "docx" && parsed.kind !== "text") return fail(415, "Upload the brand book as a PDF, Word (.docx) or text file.");

    const [clauses, terms, colours] = await Promise.all([
      db.from("guideline_clauses").select("text").eq("org_id", orgId),
      db.from("terminology").select("term").eq("org_id", orgId),
      db.from("brand_assets").select("hex").eq("org_id", orgId).eq("type", "color"),
    ]);
    const result = await draftBrandBook(parsed, { clauses: clauses.data ?? [], terms: terms.data ?? [], colours: colours.data ?? [] }, chooseImporter());
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof RequestError) return fail(e.status, e.message);
    if (e instanceof ParseError) return fail(422, e.message);
    if (e instanceof ConfigError) {
      console.error("import route not configured:", e.message);
      return fail(503, "Importing is not set up on this server yet.");
    }
    console.error("import route failed:", e instanceof Error ? e.name : "unknown");
    return fail(500, "The brand book could not be read. Please try again.");
  }
}

import { NextResponse, type NextRequest } from "next/server";
import { readAuditForm, RequestError, MAX_UPLOAD_BYTES, type AuditForm } from "@/lib/audit/request";
import { auditVersion, todayInIndia } from "@/lib/audit/service";
import { SupabaseAuditStore } from "@/lib/audit/store";
import { BURST_MESSAGE, gateForRequest } from "@/lib/audit/usage-cap";
import { createNextVersion } from "@/lib/audit/versions";
import { fetchPage, ParseError, parseUpload, type ParsedContent } from "@/lib/parsers";
import { CONTENT_BUCKET, contentFilePath, originalMime } from "@/lib/storage/files";
import { ConfigError, createServiceClient, createUserClient, type Db } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const fail = (status: number, error: string) => NextResponse.json({ error }, { status });

async function parseSource(f: AuditForm, fileBytes: Uint8Array | null): Promise<ParsedContent> {
  if (f.file && fileBytes) return parseUpload(fileBytes, { altText: f.altText ?? null, label: f.file.name.slice(0, 80) });
  if (f.url) return fetchPage(f.url);
  return parseUpload(new TextEncoder().encode(f.text!));
}

/** Creates the item (if new) and the next immutable version, as the signed-in user, so RLS decides who may submit. */
async function createVersion(db: Db, userId: string, f: AuditForm, text: string) {
  let item: { id: string; org_id: string; channel: string | null; audience: "public" | "internal" };
  if (f.itemId) {
    const { data, error } = await db.from("content_items").select("id, org_id, channel, audience").eq("id", f.itemId).maybeSingle();
    if (error || !data) throw new RequestError(404, "That content item was not found.");
    item = data;
  } else {
    const { data, error } = await db.from("content_items")
      .insert({ org_id: f.orgId!, title: f.title!, channel: f.channel, audience: f.audience, owner_id: userId })
      .select("id, org_id, channel, audience").single();
    if (error || !data) throw new RequestError(403, "You can't submit content to this organisation.");
    item = data;
  }
  return { item, version: await createNextVersion(db, item, text, userId) };
}

/**
 * Keeps the uploaded file next to its version (private bucket, server-only write) so people can open the original later.
 * Best effort: the audit works on the parsed text, so a storage problem is logged and never fails the audit.
 */
async function keepOriginal(service: ReturnType<typeof createServiceClient>, orgId: string, versionId: string, name: string, bytes: Uint8Array, parsed: ParsedContent) {
  try {
    const path = contentFilePath(orgId, versionId, name);
    const type = originalMime(parsed.kind, bytes);
    const up = await service.storage.from(CONTENT_BUCKET).upload(path, bytes, { contentType: type, upsert: false });
    if (up.error) throw new Error(up.error.message);
    const { error } = await service.from("content_versions").update({ file_path: path, file_name: name.slice(0, 120), file_type: type }).eq("id", versionId);
    if (error) throw new Error(error.message);
  } catch (e) {
    console.error("could not keep the original file:", e instanceof Error ? e.message : "unknown");
  }
}

/**
 * POST /api/audit (multipart): upload → parse → new version → audit → save (proposal §5–§7).
 * 401 not signed in · 400/413 bad input · 403/404 not allowed · 422 unreadable content · 429 too many audits · 503 not configured.
 * Every error message is fixed; internal error text is only logged, never returned.
 */
export async function POST(req: NextRequest) {
  try {
    if (Number(req.headers.get("content-length") ?? 0) > MAX_UPLOAD_BYTES + 64 * 1024) return fail(413, "Files over 10 MB are not supported.");
    const userDb = await createUserClient();
    const { data: auth } = await userDb.auth.getUser();
    if (!auth.user) return fail(401, "Please sign in.");

    let form: AuditForm;
    try {
      form = readAuditForm(await req.formData());
    } catch (e) {
      if (e instanceof RequestError) return fail(e.status, e.message);
      return fail(400, "The upload could not be read.");
    }

    // cost control (src/lib/audit/usage-cap.ts) comes before anything is stored, so a refused request leaves no item behind
    const service = createServiceClient();
    let orgId = form.orgId;
    if (!orgId && form.itemId) orgId = (await userDb.from("content_items").select("org_id").eq("id", form.itemId).maybeSingle()).data?.org_id;
    const gate = await gateForRequest(service, orgId ?? "", auth.user.id);
    if (gate.kind === "burst") return fail(429, BURST_MESSAGE);

    const fileBytes = form.file ? new Uint8Array(await form.file.arrayBuffer()) : null;
    const parsed = await parseSource(form, fileBytes);
    const { item, version } = await createVersion(userDb, auth.user.id, form, parsed.text);
    if (form.file && fileBytes) await keepOriginal(service, item.org_id, version.id, form.file.name, fileBytes, parsed);

    const colours = form.textColour && form.bgColour
      ? [{ fg: form.textColour, bg: form.bgColour, label: "Text on image", large: form.largeText === "true", confidence: "high" as const }]
      : undefined;
    const { runId, result } = await auditVersion(new SupabaseAuditStore(service), gate.ai, {
      orgId: item.org_id, versionId: version.id, requestedBy: auth.user.id, parsed,
      channel: item.channel ?? form.channel, audience: item.audience, colours, today: todayInIndia(), notes: gate.notes,
    });

    return NextResponse.json({
      itemId: item.id, versionId: version.id, versionNumber: version.n, runId,
      kind: parsed.kind, aiMode: result.aiMode, model: result.model, promptVersion: result.promptVersion,
      score: result.score, warnings: result.warnings, findings: result.findings,
    }, { status: 201 });
  } catch (e) {
    if (e instanceof RequestError) return fail(e.status, e.message);
    if (e instanceof ParseError) return fail(422, e.message);
    if (e instanceof ConfigError) {
      console.error("audit route not configured:", e.message);
      return fail(503, "Auditing is not set up on this server yet.");
    }
    console.error("audit route failed:", e instanceof Error ? e.name : "unknown");
    return fail(500, "The audit could not be completed. Please try again.");
  }
}

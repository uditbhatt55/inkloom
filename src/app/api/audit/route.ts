import { NextResponse, type NextRequest } from "next/server";
import { sha256 } from "@/lib/ai/reviewer";
import { chooseReviewer } from "@/lib/ai/select";
import { readAuditForm, RequestError, MAX_UPLOAD_BYTES, type AuditForm } from "@/lib/audit/request";
import { auditVersion, todayInIndia } from "@/lib/audit/service";
import { SupabaseAuditStore } from "@/lib/audit/store";
import { fetchPage, ParseError, parseUpload, type ParsedContent } from "@/lib/parsers";
import { ConfigError, createServiceClient, createUserClient, type Db } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const fail = (status: number, error: string) => NextResponse.json({ error }, { status });

async function parseSource(f: AuditForm): Promise<ParsedContent> {
  if (f.file) return parseUpload(new Uint8Array(await f.file.arrayBuffer()), { altText: f.altText ?? null, label: f.file.name.slice(0, 80) });
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
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data: last } = await db.from("content_versions").select("n").eq("item_id", item.id).order("n", { ascending: false }).limit(1).maybeSingle();
    const n = (last?.n ?? 0) + 1;
    const { data, error } = await db.from("content_versions")
      .insert({ org_id: item.org_id, item_id: item.id, n, text, sha256: sha256(text), created_by: userId })
      .select("id, n").single();
    if (!error && data) return { item, version: data };
    if (error?.code !== "23505") throw new RequestError(403, "You can't add a version to this item.");
    // 23505 = another upload took this version number at the same moment: retry once with the next one
  }
  throw new RequestError(409, "Another version was saved at the same time. Please try again.");
}

/**
 * POST /api/audit (multipart): upload → parse → new version → audit → save (proposal §5–§7).
 * 401 not signed in · 400/413 bad input · 403/404 not allowed · 422 unreadable content · 503 not configured.
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

    const parsed = await parseSource(form);
    const { item, version } = await createVersion(userDb, auth.user.id, form, parsed.text);

    const colours = form.textColour && form.bgColour
      ? [{ fg: form.textColour, bg: form.bgColour, label: "Text on image", large: form.largeText === "true", confidence: "high" as const }]
      : undefined;
    const { runId, result } = await auditVersion(new SupabaseAuditStore(createServiceClient()), chooseReviewer(), {
      orgId: item.org_id, versionId: version.id, requestedBy: auth.user.id, parsed,
      channel: item.channel ?? form.channel, audience: item.audience, colours, today: todayInIndia(),
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

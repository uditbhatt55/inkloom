import { NextResponse, type NextRequest } from "next/server";
import { auditVersion, todayInIndia } from "@/lib/audit/service";
import { SupabaseAuditStore } from "@/lib/audit/store";
import { BURST_MESSAGE, gateForRequest } from "@/lib/audit/usage-cap";
import { ParseError, parseUpload } from "@/lib/parsers";
import { canSubmit } from "@/lib/session";
import { ConfigError, createServiceClient, createUserClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail = (status: number, error: string) => NextResponse.json({ error }, { status });

/**
 * POST /api/items/:id/reaudit — audits the item's LATEST version again against today's guidelines, facts and terms
 * (a new audit run on the same version; the content is unchanged). Used when the audit is stale (migration
 * 20261117000100) and by Brand Health's fact impact. A kept original file is parsed again, so file checks repeat.
 * shortcut: a web page version is re-audited from its saved text (the page is not fetched again), and an image's alt text
 * and colour pair typed at upload are not stored, so they are not re-checked; store them on the version if that matters.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!UUID.test(id)) return fail(404, "That content item was not found.");
    const db = await createUserClient();
    const { data: auth } = await db.auth.getUser();
    if (!auth.user) return fail(401, "Please sign in.");

    const { data: item } = await db.from("content_items").select("id, org_id, channel, audience").eq("id", id).maybeSingle();
    if (!item) return fail(404, "That content item was not found.");
    const { data: member } = await db.from("memberships").select("role").eq("org_id", item.org_id).eq("user_id", auth.user.id).maybeSingle();
    if (!member || !canSubmit(member.role)) return fail(403, "You can't audit this item.");

    const { data: version } = await db.from("content_versions").select("id, n, text, file_path, file_name").eq("item_id", id).order("n", { ascending: false }).limit(1).maybeSingle();
    if (!version) return fail(404, "This item has no version yet.");

    const service = createServiceClient();
    const gate = await gateForRequest(service, item.org_id, auth.user.id);
    if (gate.kind === "burst") return fail(429, BURST_MESSAGE);

    const file = version.file_path ? (await service.storage.from("content-files").download(version.file_path)).data : null;
    const parsed = file
      ? await parseUpload(new Uint8Array(await file.arrayBuffer()), { label: version.file_name?.slice(0, 80) })
      : await parseUpload(new TextEncoder().encode(version.text ?? ""));
    const { runId, result } = await auditVersion(new SupabaseAuditStore(service), gate.ai, {
      orgId: item.org_id, versionId: version.id, requestedBy: auth.user.id, parsed,
      channel: item.channel ?? "web", audience: item.audience, today: todayInIndia(), notes: gate.notes,
    });
    return NextResponse.json({ itemId: item.id, versionId: version.id, versionNumber: version.n, runId, score: result.score, aiMode: result.aiMode }, { status: 201 });
  } catch (e) {
    if (e instanceof ParseError) return fail(422, e.message);
    if (e instanceof ConfigError) {
      console.error("reaudit route not configured:", e.message);
      return fail(503, "Auditing is not set up on this server yet.");
    }
    console.error("reaudit route failed:", e instanceof Error ? e.name : "unknown");
    return fail(500, "The audit could not be run again. Please try again.");
  }
}

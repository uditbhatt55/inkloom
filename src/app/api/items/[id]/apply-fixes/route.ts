import { NextResponse, type NextRequest } from "next/server";
import { applyAcceptedFixes } from "@/lib/audit/apply-fixes";
import { RequestError } from "@/lib/audit/request";
import { auditVersion, todayInIndia } from "@/lib/audit/service";
import { SupabaseAuditStore } from "@/lib/audit/store";
import { BURST_MESSAGE, gateForRequest } from "@/lib/audit/usage-cap";
import { createNextVersion } from "@/lib/audit/versions";
import { ParseError, parseUpload } from "@/lib/parsers";
import { canSubmit } from "@/lib/session";
import { ConfigError, createServiceClient, createUserClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail = (status: number, error: string) => NextResponse.json({ error }, { status });

/**
 * POST /api/items/:id/apply-fixes — proposal §8.2: accepted fixes are applied together into a new version, which is
 * re-audited. Always works on the item's LATEST version and its latest run. Item, version and findings are read with
 * the user's client (RLS); the new version is inserted as the user; only the audit run is saved with the service role.
 * Shortcut: the new version is re-audited as plain text (files are not kept in Storage yet, decision D10), so
 * file-level checks (fonts, images) are not repeated.
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
    if (!member || !canSubmit(member.role)) return fail(403, "You can't add a version to this item.");

    const { data: version } = await db.from("content_versions").select("id, n, text").eq("item_id", id).order("n", { ascending: false }).limit(1).maybeSingle();
    if (!version) return fail(404, "This item has no version yet.");
    const { data: run } = await db.from("audit_runs").select("id").eq("version_id", version.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!run) return fail(409, "The latest version has not been audited yet.");
    const { data: findings } = await db.from("findings").select("id, status, suggestion, quote, start_offset, end_offset").eq("run_id", run.id).eq("status", "accepted");

    const fixed = applyAcceptedFixes(version.text ?? "", findings ?? []);
    if (!fixed.applied.length) return fail(400, "There are no accepted fixes that can be applied to the latest version.");

    const service = createServiceClient();
    const gate = await gateForRequest(service, item.org_id, auth.user.id);
    if (gate.kind === "burst") return fail(429, BURST_MESSAGE);

    const parsed = await parseUpload(new TextEncoder().encode(fixed.text));
    const next = await createNextVersion(db, item, parsed.text, auth.user.id);
    const { runId, result } = await auditVersion(new SupabaseAuditStore(service), gate.ai, {
      orgId: item.org_id, versionId: next.id, requestedBy: auth.user.id, parsed,
      channel: item.channel ?? "web", audience: item.audience, today: todayInIndia(), notes: gate.notes,
    });

    return NextResponse.json({
      itemId: item.id, versionId: next.id, versionNumber: next.n, runId,
      applied: fixed.applied.length, skipped: fixed.skipped, score: result.score, aiMode: result.aiMode,
    }, { status: 201 });
  } catch (e) {
    if (e instanceof RequestError) return fail(e.status, e.message);
    if (e instanceof ParseError) return fail(422, e.message);
    if (e instanceof ConfigError) {
      console.error("apply-fixes route not configured:", e.message);
      return fail(503, "Auditing is not set up on this server yet.");
    }
    console.error("apply-fixes route failed:", e instanceof Error ? e.name : "unknown");
    return fail(500, "The fixes could not be applied. Please try again.");
  }
}

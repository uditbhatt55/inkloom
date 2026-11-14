import { NextResponse, type NextRequest } from "next/server";
import { chooseAiJson } from "@/lib/ai/json";
import rewriteClaim02 from "@/lib/ai/recordings/rewrite-claim-02.json";
import { fail, requireOwnerOrReviewer } from "@/lib/health/access";
import { REWRITE_JSON_SCHEMA, rewriteMessages, validateRewrite } from "@/lib/health/rewrite";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Hand-checked demo recordings, keyed by clause code; used only when the real model is off (§7.6). */
const RECORDINGS: Record<string, { clause: string; response: unknown }> = { [rewriteClaim02.code]: rewriteClaim02 };

/**
 * POST /api/health/rewrite { orgId, code }: a DRAFT rewrite of one guideline clause that reviewers often overrule.
 * Nothing is saved; the owner edits the clause in the Knowledge Centre if they agree (proposal §8.3).
 * 400 bad input · 401/403 not allowed · 404 no such clause · 422 the AI draft failed its checks · 502 AI unreachable.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { orgId?: unknown; code?: unknown };
  const access = await requireOwnerOrReviewer(body.orgId);
  if (access instanceof NextResponse) return access;
  if (typeof body.code !== "string" || !/^[A-Z]{2,5}-\d{1,3}$/.test(body.code)) return fail(400, "Missing rule code.");
  const { db, orgId } = access;

  const { data: clause } = await db.from("guideline_clauses").select("code, text").eq("org_id", orgId).eq("code", body.code).maybeSingle();
  if (!clause) return fail(404, "That rule was not found.");
  const { data: overruled } = await db.from("findings").select("quote, reason").eq("org_id", orgId).eq("rule_code", clause.code)
    .in("status", ["dismissed", "waived"]).order("run_id").limit(8);
  const notes = (overruled ?? []).map((f) => ({ quote: f.quote.slice(0, 300), reason: f.reason?.slice(0, 300) ?? null }));

  const ai = chooseAiJson();
  if (!ai) {
    const rec = RECORDINGS[clause.code];
    if (!rec || rec.clause !== clause.text) return NextResponse.json({ mode: "simulated", suggestion: null, message: "AI suggestions need the real model. Reword the rule yourself in the Knowledge Centre." });
    const v = validateRewrite(rec.response, clause.text, notes);
    return NextResponse.json({ mode: "simulated", suggestion: v.ok ? v.value : null });
  }

  let raw: unknown;
  try {
    raw = await ai.call({ messages: rewriteMessages(clause, notes), name: "clause_rewrite", schema: REWRITE_JSON_SCHEMA });
  } catch (e) {
    console.error("rewrite suggestion failed", e instanceof Error ? e.message : e);
    return fail(502, "The AI could not be reached. Please try again.");
  }
  const v = validateRewrite(raw, clause.text, notes);
  if (!v.ok) {
    console.error("rewrite suggestion rejected:", v.reason);
    return fail(422, "The AI draft did not pass our checks. Please try again.");
  }
  return NextResponse.json({ mode: "real", model: ai.model, suggestion: v.value });
}

import { NextResponse, type NextRequest } from "next/server";
import { chooseAiJson } from "@/lib/ai/json";
import { comparableClauses, CONFLICT_JSON_SCHEMA, conflictMessages, validateConflicts } from "@/lib/health/clause-conflicts";
import { fail, requireOwnerOrReviewer } from "@/lib/health/access";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/health/conflicts { orgId }: asks the model whether any two ACTIVE clauses of one category contradict each other.
 * Only pairs of real, active clauses in one category are returned (the same kind of citation check as audit findings).
 * Without the real model there is nothing honest to show, so the answer says so instead of "no conflicts".
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { orgId?: unknown };
  const access = await requireOwnerOrReviewer(body.orgId);
  if (access instanceof NextResponse) return access;
  const { db, orgId } = access;

  const { data } = await db.from("guideline_clauses").select("code, category, text, status").eq("org_id", orgId);
  const clauses = comparableClauses(data ?? []);
  if (clauses.length < 2) return NextResponse.json({ mode: "none", checked: clauses.length, conflicts: [], message: "No category has two active rules to compare yet." });

  const ai = chooseAiJson();
  if (!ai) return NextResponse.json({ mode: "simulated", checked: clauses.length, conflicts: null, message: "The AI conflict check needs the real model. The check of conflicting terms above is always on." });

  let raw: unknown;
  try {
    raw = await ai.call({ messages: conflictMessages(clauses), name: "clause_conflicts", schema: CONFLICT_JSON_SCHEMA });
  } catch (e) {
    console.error("clause conflict check failed", e instanceof Error ? e.message : e);
    return fail(502, "The AI could not be reached. Please try again.");
  }
  const checked = validateConflicts(raw, clauses);
  if (!checked) return fail(422, "The AI answer did not pass our checks. Please try again.");
  return NextResponse.json({ mode: "real", model: ai.model, checked: clauses.length, conflicts: checked.conflicts });
}

import type { Db } from "@/lib/supabase/server";
import { conflictingTerms, factImpact, recurringMistakes, unclearRules, type ApprovedLink, type HealthFinding } from "./detectors";

/**
 * Reads one organisation's history through the viewer's RLS client and runs the four detectors.
 * shortcut: reads up to 5000 findings and aggregates in the server; move the counting into SQL views once an
 * organisation has more history than that.
 */
export async function loadBrandHealth(db: Db, orgId: string, today: string) {
  const [findings, runs, versions, items, members, facts, terms, links, approvals] = await Promise.all([
    db.from("findings").select("rule_code, status, quote, run_id").eq("org_id", orgId).limit(5000),
    db.from("audit_runs").select("id, version_id, created_at").eq("org_id", orgId),
    db.from("content_versions").select("id, item_id").eq("org_id", orgId),
    db.from("content_items").select("id, title, channel, owner_id, status").eq("org_id", orgId),
    db.from("memberships").select("user_id, role").eq("org_id", orgId),
    db.from("approved_facts").select("id, code, statement, valid_until, updated_at").eq("org_id", orgId),
    db.from("terminology").select("code, term, kind, replacement").eq("org_id", orgId),
    db.from("claim_links").select("fact_id, version_id").eq("org_id", orgId),
    db.from("decisions").select("item_id, created_at").eq("org_id", orgId).eq("decision", "approve"),
  ]);
  const failed = [findings, runs, versions, items, members, facts, terms, links, approvals].find((r) => r.error);
  if (failed?.error) throw new Error(failed.error.message);

  const runById = new Map((runs.data ?? []).map((r) => [r.id, r]));
  const itemOfVersion = new Map((versions.data ?? []).map((v) => [v.id, v.item_id]));
  const itemById = new Map((items.data ?? []).map((i) => [i.id, i]));
  const roleOf = new Map((members.data ?? []).map((m) => [m.user_id, m.role as string]));
  const approvedAt = new Map<string, string>();
  for (const d of approvals.data ?? []) if ((approvedAt.get(d.item_id) ?? "") < d.created_at) approvedAt.set(d.item_id, d.created_at);

  const healthFindings: HealthFinding[] = [];
  for (const f of findings.data ?? []) {
    const run = runById.get(f.run_id);
    const item = run && itemById.get(itemOfVersion.get(run.version_id) ?? "");
    if (!run || !item) continue;
    healthFindings.push({
      ruleCode: f.rule_code, status: f.status, quote: f.quote, channel: item.channel,
      creatorRole: roleOf.get(item.owner_id) ?? null, at: run.created_at,
    });
  }

  const approvedLinks: ApprovedLink[] = [];
  for (const l of links.data ?? []) {
    const item = itemById.get(itemOfVersion.get(l.version_id) ?? "");
    if (item?.status !== "approved") continue;
    approvedLinks.push({ factId: l.fact_id, itemId: item.id, itemTitle: item.title, approvedAt: approvedAt.get(item.id) ?? null });
  }

  return {
    findingCount: healthFindings.length,
    recurring: recurringMistakes(healthFindings, today),
    unclear: unclearRules(healthFindings),
    conflicts: conflictingTerms(terms.data ?? []),
    factAlerts: factImpact(
      (facts.data ?? []).map((f) => ({ id: f.id, code: f.code, statement: f.statement, validUntil: f.valid_until, updatedAt: f.updated_at })),
      approvedLinks, today,
    ),
  };
}

export type BrandHealth = Awaited<ReturnType<typeof loadBrandHealth>>;

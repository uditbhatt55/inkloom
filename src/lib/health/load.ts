import type { Db } from "@/lib/supabase/server";
import {
  addDays, conflictingTerms, expiringFacts, factImpact, recurringMistakes, ruleChangeImpact, unclearRules, weeklyTrend,
  type ApprovedLink, type AuditedRun, type HealthFinding,
} from "./detectors";

/**
 * Reads one organisation's history through the viewer's RLS client and runs the four detectors.
 * shortcut: reads up to 5000 findings and aggregates in the server; move the counting into SQL views once an
 * organisation has more history than that.
 */
export async function loadBrandHealth(db: Db, orgId: string, today: string) {
  const [findings, runs, versions, items, members, facts, terms, links, approvals, clauses, history] = await Promise.all([
    db.from("findings").select("rule_code, status, quote, run_id").eq("org_id", orgId).limit(5000),
    db.from("audit_runs").select("id, version_id, created_at").eq("org_id", orgId),
    db.from("content_versions").select("id, item_id").eq("org_id", orgId),
    db.from("content_items").select("id, title, channel, owner_id, status").eq("org_id", orgId),
    db.from("memberships").select("user_id, role").eq("org_id", orgId),
    db.from("approved_facts").select("id, code, statement, valid_until, updated_at").eq("org_id", orgId),
    db.from("terminology").select("code, term, kind, replacement").eq("org_id", orgId),
    db.from("claim_links").select("fact_id, version_id").eq("org_id", orgId),
    db.from("decisions").select("item_id, created_at").eq("org_id", orgId).eq("decision", "approve"),
    db.from("guideline_clauses").select("id, code").eq("org_id", orgId),
    db.from("guideline_clause_history").select("clause_id, version, changed_at").eq("org_id", orgId).gte("changed_at", `${addDays(today, -30)}T00:00:00Z`),
  ]);
  const failed = [findings, runs, versions, items, members, facts, terms, links, approvals, clauses, history].find((r) => r.error);
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
      itemId: item.id, ruleCode: f.rule_code, status: f.status, quote: f.quote, channel: item.channel,
      creatorRole: roleOf.get(item.owner_id) ?? null, at: run.created_at,
    });
  }

  // every audit run with the rule codes it raised (also runs with none), for the trend and rule-change impact
  const codesOfRun = new Map<string, string[]>();
  for (const f of findings.data ?? []) if (f.rule_code) codesOfRun.set(f.run_id, [...(codesOfRun.get(f.run_id) ?? []), f.rule_code]);
  const auditedRuns: AuditedRun[] = [];
  for (const r of runs.data ?? []) {
    const item = itemById.get(itemOfVersion.get(r.version_id) ?? "");
    if (item) auditedRuns.push({ itemId: item.id, itemTitle: item.title, at: r.created_at, ruleCodes: codesOfRun.get(r.id) ?? [] });
  }
  const since = addDays(today, -30);
  const postsAudited30 = new Set(auditedRuns.filter((r) => r.at.slice(0, 10) >= since).map((r) => r.itemId)).size;
  const codeOfClause = new Map((clauses.data ?? []).map((c) => [c.id, c.code]));
  // a history row keeps the OLD text with its version; the new version (version + 1) started at changed_at
  const changes = (history.data ?? []).flatMap((h) => {
    const code = codeOfClause.get(h.clause_id);
    return code ? [{ code, changedAt: h.changed_at, version: h.version + 1 }] : [];
  });
  const factRows = (facts.data ?? []).map((f) => ({ id: f.id, code: f.code, statement: f.statement, validUntil: f.valid_until, updatedAt: f.updated_at }));

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
    postsAudited30,
    factAlerts: factImpact(factRows, approvedLinks, today),
    expiring: expiringFacts(factRows, today),
    trend: weeklyTrend(auditedRuns, healthFindings, today),
    ruleChanges: ruleChangeImpact(changes, auditedRuns),
  };
}

export type BrandHealth = Awaited<ReturnType<typeof loadBrandHealth>>;

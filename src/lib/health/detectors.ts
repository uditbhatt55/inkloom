/**
 * Brand Health detectors (proposal §8.3, milestone M5). Pure: callers pass rows, nothing touches the database.
 * Recommendations are drafts for the brand owner; nothing here changes a rule.
 */

export type HealthFinding = {
  ruleCode: string | null; status: string; quote: string;
  channel: string | null; creatorRole: string | null;
  /** when the audit run that produced it was created (ISO) */
  at: string;
};

/** A reviewer said the finding was wrong (dismiss) or allowed an exception (waive). */
const OVERRULED = new Set(["dismissed", "waived"]);
const DECIDED = new Set(["accepted", "rejected", "dismissed", "waived", "resolved"]);

/** YYYY-MM-DD plus n days (n may be negative). */
export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const tally = (values: (string | null)[]) => {
  const m = new Map<string, number>();
  for (const v of values) m.set(v ?? "unknown", (m.get(v ?? "unknown") ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
};

export type Recurring = { ruleCode: string; count: number; byChannel: [string, number][]; byRole: [string, number][] };

/**
 * Detector 1, recurring mistakes: findings per rule in the last `days` days, with the channels and creator roles they
 * came from. Dismissed and waived findings are not mistakes, so they are left out; a creator's rejection still counts
 * (decision D1). Findings with no rule code (unverified claims) are left out: they have no rule to fix.
 */
export function recurringMistakes(findings: HealthFinding[], today: string, days = 30, top = 10): Recurring[] {
  const since = addDays(today, -days);
  const byRule = new Map<string, HealthFinding[]>();
  for (const f of findings) {
    if (!f.ruleCode || OVERRULED.has(f.status) || f.at.slice(0, 10) < since) continue;
    byRule.set(f.ruleCode, [...(byRule.get(f.ruleCode) ?? []), f]);
  }
  return [...byRule.entries()]
    .map(([ruleCode, fs]) => ({ ruleCode, count: fs.length, byChannel: tally(fs.map((f) => f.channel)), byRole: tally(fs.map((f) => f.creatorRole)) }))
    .sort((a, b) => b.count - a.count || a.ruleCode.localeCompare(b.ruleCode))
    .slice(0, top);
}

export type Unclear = { ruleCode: string; decided: number; overruled: number; rate: number; examples: string[] };

/**
 * Detector 2, unclear rules: rules whose findings reviewers often dismiss or waive. A high rate suggests the rule is
 * too broad or badly worded. Needs `minDecided` decisions so one dismissal does not flag a rule.
 */
export function unclearRules(findings: HealthFinding[], opts: { minDecided?: number; threshold?: number } = {}): Unclear[] {
  const { minDecided = 5, threshold = 0.4 } = opts;
  const byRule = new Map<string, HealthFinding[]>();
  for (const f of findings) {
    if (!f.ruleCode || !DECIDED.has(f.status)) continue;
    byRule.set(f.ruleCode, [...(byRule.get(f.ruleCode) ?? []), f]);
  }
  const out: Unclear[] = [];
  for (const [ruleCode, fs] of byRule) {
    const over = fs.filter((f) => OVERRULED.has(f.status));
    const rate = over.length / fs.length;
    if (fs.length < minDecided || rate < threshold) continue;
    out.push({ ruleCode, decided: fs.length, overruled: over.length, rate, examples: [...new Set(over.map((f) => f.quote))].slice(0, 3) });
  }
  return out.sort((a, b) => b.rate - a.rate || b.decided - a.decided);
}

export type TermRow = { code: string; term: string; kind: string; replacement: string | null };
export type Conflict = { term: string; codes: string[]; reason: string };

const norm = (s: string) => s.trim().toLowerCase().split(/[\s\-_]+/).filter(Boolean).join(" ");

/**
 * Detector 3, conflicting rules (the deterministic part of §8.3): the same term both preferred and banned, an internal
 * codename also listed as preferred, or a banned term whose replacement is itself banned.
 * shortcut: no AI comparison of clause pairs yet; add it as an on-demand action when time allows.
 */
export function conflictingTerms(terms: TermRow[]): Conflict[] {
  const byTerm = new Map<string, TermRow[]>();
  for (const t of terms) byTerm.set(norm(t.term), [...(byTerm.get(norm(t.term)) ?? []), t]);
  const out: Conflict[] = [];
  for (const [term, ts] of byTerm) {
    const kinds = new Set(ts.map((t) => t.kind));
    const codes = ts.map((t) => t.code).sort();
    if (kinds.has("preferred") && kinds.has("banned")) out.push({ term, codes, reason: "listed as both preferred and banned" });
    if (kinds.has("preferred") && kinds.has("internal")) out.push({ term, codes, reason: "an internal codename is also listed as preferred" });
  }
  for (const t of terms) {
    if (t.kind !== "banned" || !t.replacement) continue;
    const target = byTerm.get(norm(t.replacement))?.filter((x) => x.kind === "banned") ?? [];
    if (target.length) out.push({ term: norm(t.term), codes: [t.code, ...target.map((x) => x.code)].sort(), reason: `its replacement "${t.replacement}" is itself banned` });
  }
  return out;
}

export type FactRow = { id: string; code: string; statement: string; validUntil: string | null; updatedAt: string };
export type ApprovedLink = { factId: string; itemId: string; itemTitle: string; approvedAt: string | null };
export type FactAlert = {
  code: string; statement: string; reason: "expired" | "expiring" | "changed";
  items: { id: string; title: string; approvedAt: string | null; changedAfterApproval: boolean }[];
};

/**
 * Detector 4, fact impact: approved content that relies on a fact (claim links) when that fact has expired, expires
 * within `soonDays`, or was edited after the content was approved. Expired beats expiring beats changed.
 */
export function factImpact(facts: FactRow[], links: ApprovedLink[], today: string, soonDays = 30): FactAlert[] {
  const out: FactAlert[] = [];
  for (const f of facts) {
    const mine = links.filter((l) => l.factId === f.id);
    if (!mine.length) continue;
    const seen = new Set<string>();
    const items = mine.filter((l) => !seen.has(l.itemId) && seen.add(l.itemId)).map((l) => ({
      id: l.itemId, title: l.itemTitle, approvedAt: l.approvedAt,
      changedAfterApproval: !!l.approvedAt && f.updatedAt > l.approvedAt,
    }));
    const reason = f.validUntil && f.validUntil < today ? "expired"
      : f.validUntil && f.validUntil <= addDays(today, soonDays) ? "expiring"
      : items.some((i) => i.changedAfterApproval) ? "changed" : null;
    if (reason) out.push({ code: f.code, statement: f.statement, reason, items });
  }
  const order = { expired: 0, expiring: 1, changed: 2 };
  return out.sort((a, b) => order[a.reason] - order[b.reason] || a.code.localeCompare(b.code));
}

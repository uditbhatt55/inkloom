/**
 * Brand Health detectors (proposal §8.3, milestone M5). Pure: callers pass rows, nothing touches the database.
 * Recommendations are drafts for the brand owner; nothing here changes a rule.
 */

export type HealthFinding = {
  /** the content item the finding belongs to, so one post is counted once per rule however many versions repeat it */
  itemId: string;
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
 * Detector 1, recurring mistakes: posts that broke each rule in the last `days` days, with the channels and creator roles
 * they came from. A post counts once per rule: the same mistake in version 1 and again in version 2 is one mistake, and
 * several findings of one rule in one version are one post too. Dismissed and waived findings are not mistakes, so they
 * are left out; a creator's rejection still counts (decision D1). Findings with no rule code (unverified claims) are left
 * out: they have no rule to fix.
 */
export function recurringMistakes(findings: HealthFinding[], today: string, days = 30, top = 10): Recurring[] {
  const since = addDays(today, -days);
  const byRule = new Map<string, HealthFinding[]>();
  const seen = new Set<string>();
  for (const f of findings) {
    if (!f.ruleCode || OVERRULED.has(f.status) || f.at.slice(0, 10) < since) continue;
    const key = `${f.itemId}|${f.ruleCode}`;
    if (seen.has(key)) continue;
    seen.add(key);
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

/* ---------------------------------------------------------------- Round 3 (improvement 3) */

/** A signal resting on fewer cases than this is shown with a "small sample" badge. */
export const SOLID_SAMPLE = 10;
export const isSmallSample = (n: number) => n < SOLID_SAMPLE;

export type ExpiringFact = { code: string; statement: string; validUntil: string; daysLeft: number };

/**
 * Facts that have expired or expire within `soonDays`, whether or not approved content uses them yet, so the owner can
 * renew or retire a fact before writers rely on it. Soonest first.
 */
export function expiringFacts(facts: FactRow[], today: string, soonDays = 30): ExpiringFact[] {
  const limit = addDays(today, soonDays);
  const days = (d: string) => Math.round((Date.parse(`${d}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
  return facts
    .filter((f): f is FactRow & { validUntil: string } => !!f.validUntil && f.validUntil <= limit)
    .map((f) => ({ code: f.code, statement: f.statement, validUntil: f.validUntil, daysLeft: days(f.validUntil) }))
    .sort((a, b) => a.daysLeft - b.daysLeft || a.code.localeCompare(b.code));
}

export type AuditedRun = { itemId: string; itemTitle: string; at: string; ruleCodes: string[] };
export type WeekPoint = { weekStart: string; posts: number; mistakes: number };

/**
 * Trend: per week (Monday start, UTC), how many posts were audited and how many rule mistakes they had, counted once
 * per post and rule like detector 1. `runs` gives the audited posts (also those with no findings).
 */
export function weeklyTrend(runs: AuditedRun[], findings: HealthFinding[], today: string, weeks = 8): WeekPoint[] {
  const monday = (d: string) => addDays(d, -((new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7));
  const first = addDays(monday(today), -7 * (weeks - 1));
  const out = new Map<string, { posts: Set<string>; mistakes: Set<string> }>();
  for (let i = 0; i < weeks; i++) out.set(addDays(first, 7 * i), { posts: new Set(), mistakes: new Set() });
  for (const r of runs) out.get(monday(r.at.slice(0, 10)))?.posts.add(r.itemId);
  for (const f of findings) {
    if (!f.ruleCode || OVERRULED.has(f.status)) continue;
    out.get(monday(f.at.slice(0, 10)))?.mistakes.add(`${f.itemId}|${f.ruleCode}`);
  }
  return [...out.entries()].map(([weekStart, w]) => ({ weekStart, posts: w.posts.size, mistakes: w.mistakes.size }));
}

export type ClauseChange = { code: string; changedAt: string; version: number };
export type RuleImpact = ClauseChange & {
  /** posts audited both before and after the change */
  compared: number;
  newlyFlagged: { id: string; title: string }[];
  noLongerRaised: { id: string; title: string }[];
};

/**
 * Rule-change impact: for each clause change, the posts that were audited before AND after it (a stale audit's
 * re-audit), comparing the last run before with the first run after. Measured from real audits, not simulated: a post
 * never re-audited is not counted. Newest change first.
 */
export function ruleChangeImpact(changes: ClauseChange[], runs: AuditedRun[]): RuleImpact[] {
  const byItem = new Map<string, AuditedRun[]>();
  for (const r of runs) byItem.set(r.itemId, [...(byItem.get(r.itemId) ?? []), r]);
  for (const rs of byItem.values()) rs.sort((a, b) => a.at.localeCompare(b.at));
  return changes
    .map((c) => {
      const impact: RuleImpact = { ...c, compared: 0, newlyFlagged: [], noLongerRaised: [] };
      for (const rs of byItem.values()) {
        const before = rs.filter((r) => r.at < c.changedAt).at(-1);
        const after = rs.find((r) => r.at >= c.changedAt);
        if (!before || !after) continue;
        impact.compared++;
        const was = before.ruleCodes.includes(c.code), now = after.ruleCodes.includes(c.code);
        if (!was && now) impact.newlyFlagged.push({ id: after.itemId, title: after.itemTitle });
        if (was && !now) impact.noLongerRaised.push({ id: after.itemId, title: after.itemTitle });
      }
      return impact;
    })
    .sort((a, b) => b.changedAt.localeCompare(a.changedAt));
}

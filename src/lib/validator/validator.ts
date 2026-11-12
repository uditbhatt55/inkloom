import { CATEGORIES, CONFIDENCES, SEVERITIES, type Category, type Confidence, type Finding, type Severity } from "@/lib/audit/types";

/** What the AI returns (proposal §7.2). Offsets are advisory only: models miscount characters. */
export type RawAiFinding = {
  quote: string; start: number; end: number; category: Category; severity: Severity; confidence: Confidence;
  ruleId: string | null; explanation: string; suggestion: string | null;
};

/** Codes of the PUBLIC, active clauses/facts/terms of this organisation, i.e. what was sent to the model. */
export type KnownCodes = { clauses: Set<string>; facts: Set<string>; terms: Set<string> };
export type Rejected = { raw: RawAiFinding; reason: string };

const RANK: Record<Confidence, number> = { low: 1, medium: 2, high: 3 };
const oneOf = (list: readonly string[], v: unknown) => typeof v === "string" && list.includes(v);

function nearest(text: string, quote: string, near: number): number {
  let best = -1, bestDist = Infinity;
  for (let i = text.indexOf(quote); i !== -1; i = text.indexOf(quote, i + 1)) {
    const d = Math.abs(i - near);
    if (d < bestDist) { best = i; bestDist = d; }
  }
  return best;
}

/**
 * The gate every AI finding must pass (proposal §7.3, decision D3). Nothing from the model reaches a user without it.
 *  0. enums and required text are checked at runtime, never trusted from types.
 *  1. quote (trimmed) must exist verbatim in the content, else DISCARDED. If it exists, offsets are corrected to the nearest occurrence;
 *     missing or non-numeric offsets are ignored.
 *  2. cited code must exist for this org, else kept as "needs human check", low confidence (no score impact).
 *  3. claim/factual with no source -> "unverified claim", low confidence. We never call a claim false without a source.
 *  4. a suggestion that is empty, identical to the quote, or reaches outside the quoted span is removed; the finding stays.
 *  5. tone and visual findings are at most medium confidence (§10.4, §12.2).
 * shortcut: span check is a heuristic (length + neighbouring-text echo); tighten it if the eval set shows rewrites slipping through.
 */
export function validateAiFindings(raw: RawAiFinding[], content: string, known: KnownCodes) {
  const accepted: Finding[] = [];
  const rejected: Rejected[] = [];

  for (const r of raw) {
    if (!oneOf(CATEGORIES, r.category) || !oneOf(SEVERITIES, r.severity) || !oneOf(CONFIDENCES, r.confidence)
        || typeof r.quote !== "string" || typeof r.explanation !== "string" || !r.explanation.trim()) {
      rejected.push({ raw: r, reason: "invalid field" }); continue;
    }
    const quote = r.quote.trim();
    if (!quote) { rejected.push({ raw: r, reason: "empty quote" }); continue; }
    const start = nearest(content, quote, Number.isFinite(r.start) ? r.start : 0);
    if (start < 0) { rejected.push({ raw: r, reason: "quote not found in content" }); continue; }
    const end = start + quote.length;

    const suggestion = typeof r.suggestion === "string" && r.suggestion.trim() && r.suggestion.trim() !== quote ? r.suggestion.trim() : null;
    const f: Finding = {
      quote, start, end, category: r.category, severity: r.severity, confidence: r.confidence,
      source: "ai", ruleCode: null, explanation: r.explanation.trim(), suggestion, status: "open", label: null,
    };

    const code = typeof r.ruleId === "string" ? r.ruleId.trim() || null : null;
    if (code && (known.clauses.has(code) || known.facts.has(code) || known.terms.has(code))) {
      f.ruleCode = code;
    } else {
      f.confidence = "low";
      if (!code && (f.category === "claim" || f.category === "factual")) {
        f.label = "unverified_claim";
        f.explanation = `Unverified claim: ${f.explanation}`;
      } else {
        f.label = "needs_human_check";
      }
    }

    if ((f.category === "tone" || f.category === "visual") && f.confidence === "high") f.confidence = "medium";

    if (f.suggestion !== null) {
      const before = content.slice(Math.max(0, start - 30), start).trimEnd().slice(-12);
      const after = content.slice(end, end + 30).trimStart().slice(0, 12);
      const outside = (before.length === 12 && f.suggestion.includes(before)) || (after.length === 12 && f.suggestion.includes(after));
      if (outside || f.suggestion.length > quote.length * 3 + 40) f.suggestion = null;
    }

    accepted.push(f);
  }
  return { accepted, rejected };
}

/**
 * Step 5 of the pipeline. Findings of the same category whose spans overlap are one issue: keep the higher confidence,
 * ties keep the first (rule findings come first). This also stops "Project Atlas" + "Atlas" double-deducting.
 */
export function mergeFindings(rule: Finding[], ai: Finding[]): Finding[] {
  const out: Finding[] = [];
  for (const f of [...rule, ...ai]) {
    const i = out.findIndex((o) => o.category === f.category && o.start < f.end && f.start < o.end);
    if (i < 0) out.push(f);
    else if (RANK[f.confidence] > RANK[out[i].confidence]) out[i] = f;
  }
  return out.sort((x, y) => x.start - y.start);
}

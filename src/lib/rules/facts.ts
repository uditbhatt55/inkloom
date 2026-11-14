import type { Finding } from "@/lib/audit/types";
import { findFigure } from "@/lib/text/match";

export type Fact = { code: string; statement: string; validUntil: string | null };

/** `today` is passed in (YYYY-MM-DD) so the function stays pure. A fact is valid through its valid_until date. */
export const isExpired = (f: Fact, today: string) => f.validUntil !== null && f.validUntil < today;

const figuresOf = (statement: string) => statement.match(/\d+(?:[.,]\d+)*%?/g);

/**
 * Facts the content restates: every figure of the fact appears as a whole number (same matching as checkExpiredFacts).
 * Stored as claim links so Brand Health can list approved content that relies on a fact after it changes (§8.3).
 * shortcut: figure matching only; a fact with no number is never linked here, an AI citation would be needed for those.
 */
export function linkFacts(text: string, facts: { code: string; statement: string }[]): { code: string; quote: string }[] {
  const out: { code: string; quote: string }[] = [];
  for (const fact of facts) {
    const figures = figuresOf(fact.statement);
    if (!figures) continue;
    const hits = figures.map((fig) => findFigure(text, fig)[0]);
    if (hits.some((h) => !h)) continue;
    out.push({ code: fact.code, quote: hits.reduce((a, b) => (a!.start <= b!.start ? a : b))!.quote });
  }
  return out;
}

/**
 * Flags content that restates an expired fact. A fact counts as restated when EVERY figure in its statement
 * (e.g. "99.9%") appears in the text as a whole number.
 * shortcut: figure matching only; facts without numbers are never flagged here, use claim_links (fact-impact) for those.
 */
export function checkExpiredFacts(text: string, facts: Fact[], today: string): Finding[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) throw new Error(`today must be YYYY-MM-DD, got "${today}"`);
  const out: Finding[] = [];
  for (const fact of facts) {
    if (!isExpired(fact, today)) continue;
    const figures = figuresOf(fact.statement);
    if (!figures) continue;
    const hits = figures.map((fig) => findFigure(text, fig)[0]);
    if (hits.some((h) => !h)) continue;
    const first = hits.reduce((a, b) => (a!.start <= b!.start ? a : b))!;
    out.push({
      quote: first.quote, start: first.start, end: first.end,
      category: "factual", severity: "major", confidence: "high", source: "rule", ruleCode: fact.code,
      explanation: `${fact.code} expired on ${fact.validUntil}. Check that this figure is still correct before publishing.`,
      suggestion: null, status: "open", label: null,
    });
  }
  return out;
}

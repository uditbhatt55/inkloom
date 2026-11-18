import type { Finding } from "@/lib/audit/types";

/**
 * Structured facts (Round 3, improvement 1). A fact may carry fields besides its sentence; the checker compares the
 * content's figures with those fields, so "99.99% uptime" against 99.9, "annual" against monthly, USD against INR or a
 * region the fact does not cover are told apart by structure, not by string matching. Pure.
 */
export type StructuredFact = {
  code: string; statement: string; validUntil: string | null;
  metric: string | null; value: number | null; unit: string | null; period: string | null;
  currency: string | null; region: string | null; product: string | null; condition: string | null;
};

const CURRENCY: [RegExp, string][] = [[/₹|\brs\.?|\binr\b/i, "INR"], [/\$|\busd\b/i, "USD"], [/€|\beur\b/i, "EUR"], [/£|\bgbp\b/i, "GBP"]];
const PERIOD: [RegExp, string][] = [
  [/\b(per|a|each|every)\s+month\b|\bmonthly\b|\/\s*mo(nth)?\b/i, "month"],
  [/\b(per|a|each|every)\s+year\b|\b(annual(ly)?|yearly)\b|\/\s*y(ea)?r\b/i, "year"],
  [/\b(per|a|each|every)\s+(week)\b|\bweekly\b/i, "week"],
  [/\b(per|a|each|every)\s+day\b|\bdaily\b/i, "day"],
];
const REGIONS: [RegExp, string][] = [
  [/\bindia\b/i, "India"], [/\b(USA|US|United States)\b/, "US"], [/\b(europe|eu)\b/i, "EU"], [/\b(UK|United Kingdom)\b/, "UK"], // capitals only: "contact us" is not a region [/\b(global(ly)?|worldwide)\b/i, "Global"],
];
const norm = (s: string | null) => (s ?? "").trim().toLowerCase();
const has = (sentence: string, word: string | null) => !!word && sentence.toLowerCase().includes(norm(word));
const first = (rules: [RegExp, string][], s: string) => rules.find(([re]) => re.test(s))?.[1] ?? null;
const NUMBER = /(₹|\brs\.?\s?|\binr\s?|\$|\busd\s?|€|\beur\s?|£|\bgbp\s?)?(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?\s?(%|percent\b)?/gi;

type Claim = { start: number; end: number; quote: string; value: number; percent: boolean; currency: string | null };

function claimsIn(sentence: string, offset: number): Claim[] {
  return [...sentence.matchAll(NUMBER)].map((m) => ({
    start: offset + m.index!, end: offset + m.index! + m[0].trimEnd().length, quote: m[0].trimEnd(),
    value: Number(`${m[2].replace(/,/g, "")}${m[3] ?? ""}`), percent: !!m[4], currency: m[1] ? first(CURRENCY, m[1]) : null,
  }));
}

/**
 * Does this figure talk about this fact? Same product (when the fact names one) and the same kind of quantity: a
 * percentage next to the fact's metric word, an amount of money, or a count followed by the fact's unit ("14 countries").
 */
function about(f: StructuredFact, sentence: string, c: Claim, after: string): boolean {
  if (f.product && !has(sentence, f.product)) return false;
  if (f.unit === "%") return c.percent && has(sentence, f.metric);
  if (f.currency) return !c.percent && (!!c.currency || has(sentence, f.metric));
  return !c.percent && !c.currency && !!f.unit && after.trimStart().toLowerCase().startsWith(norm(f.unit).replace(/s$/, ""));
}

export function checkStructuredFacts(text: string, facts: StructuredFact[], today: string): Finding[] {
  const current = facts.filter((f) => f.value !== null && (f.metric || f.product) && !(f.validUntil && f.validUntil < today));
  const out: Finding[] = [];
  // sentences end at . ! ? followed by a space or the end, so "99.9" stays in one piece
  for (const m of text.matchAll(/(?:[^.!?\n]|[.!?](?![\s]|$))+[.!?]?/g)) {
    const sentence = m[0], offset = m.index!;
    for (const c of claimsIn(sentence, offset)) {
      const group = current.filter((f) => about(f, sentence, c, text.slice(c.end, c.end + 40)));
      if (!group.length) continue;
      const same = group.find((f) => f.value === c.value);
      const finding = (f: StructuredFact, what: string, confidence: "high" | "medium", suggestion: string | null): Finding => ({
        quote: c.quote, start: c.start, end: c.end, category: "factual", severity: "major", confidence, source: "rule", ruleCode: f.code,
        explanation: `${what} The approved fact ${f.code} says: "${f.statement}".`, suggestion, status: "open", label: null,
      });
      if (!same) {
        const f = group[0];
        const right = f.unit === "%" ? `${f.value}%` : f.currency ? `${f.currency} ${f.value}` : `${f.value}`;
        out.push(finding(f, `This figure (${c.quote}) does not match the approved value ${right}.`, "high", f.unit === "%" || !f.currency ? right : null));
        continue;
      }
      if (same.currency && c.currency && c.currency !== same.currency) {
        out.push(finding(same, `The currency here is ${c.currency}, but the approved price is in ${same.currency}.`, "high", `${same.currency} ${same.value}`));
      }
      const period = first(PERIOD, sentence);
      if (same.period && period && period !== norm(same.period)) {
        out.push(finding(same, `This says per ${period}, but the approved figure is per ${norm(same.period)}.`, "medium", null));
      }
      const region = first(REGIONS, sentence);
      if (same.region && region && norm(region) !== norm(same.region)) {
        out.push(finding(same, `This applies the figure to ${region}, but the approved fact covers ${same.region} only.`, "medium", null));
      }
    }
  }
  return out;
}

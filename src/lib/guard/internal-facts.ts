import type { Finding } from "@/lib/audit/types";
import { findFigure, findTerm, type Match } from "@/lib/text/match";

export type InternalFact = { code: string; statement: string };

const STOP = new Set(["the", "and", "for", "are", "will", "with", "from", "that", "this", "our", "has", "have", "been", "into", "its", "was", "not"]);
const NEAR = 160; // characters around the figure in which the rest of the statement must appear

const tokens = (s: string) => (s.match(/[A-Za-z0-9][A-Za-z0-9.,%]*/g) ?? []).map((t) => t.replace(/[.,]+$/, ""));
/** A figure worth matching on its own: 3+ digits, a percentage or a decimal. "Q3" or "3" would match almost any text. */
const significant = (t: string) => /^\d/.test(t) && (t.replace(/\D/g, "").length >= 3 || /[%.,]/.test(t));

const leak = (code: string, start: number, end: number, quote: string): Finding => ({
  quote, start, end, category: "confidentiality", severity: "critical", confidence: "high", source: "rule", ruleCode: code,
  explanation: `This restates an internal-only fact (${code}) in public content.`,
  suggestion: "Remove it until the owner publishes this fact.",
  status: "open", label: null,
});

/* ---------------------------------------------------------------- paraphrase (fuzzy) matching */

const MULT: Record<string, number> = { k: 1e3, thousand: 1e3, lakh: 1e5, lakhs: 1e5, m: 1e6, million: 1e6, crore: 1e7, crores: 1e7, bn: 1e9, billion: 1e9 };
/** Numbers written in any common way: 12000, 12,000, 12k, 12 thousand, 1.2 lakh. Value plus where it sits in the text. */
export function numbersIn(text: string): { value: number; percent: boolean; start: number; end: number }[] {
  const out: { value: number; percent: boolean; start: number; end: number }[] = [];
  for (const m of text.matchAll(/(?<![\w.])(\d{1,3}(?:,\d{2,3})+|\d+(?:\.\d+)?)\s?(%|k|thousand|lakhs?|m|million|crores?|bn|billion)?(?![\p{L}\d])/giu)) {
    const base = Number(m[1].replace(/,/g, ""));
    const unit = m[2]?.toLowerCase();
    if (!Number.isFinite(base)) continue;
    out.push({ value: unit === "%" || !unit ? base : base * (MULT[unit] ?? 1), percent: unit === "%", start: m.index!, end: m.index! + m[0].length });
  }
  return out;
}

const SYNONYMS = [
  ["launch", "release", "ship", "debut", "rollout", "unveil", "live", "available"],
  ["customer", "client", "account", "subscriber", "user"],
  ["target", "goal", "aim", "objective", "ambition", "plan"],
  ["price", "cost", "fee", "pricing"],
  ["revenue", "sale", "income", "turnover"],
];
const SYN = new Map(SYNONYMS.flatMap((g, i) => g.map((w) => [w, i] as const)));
/** Same word family: drops plural and verb endings, then maps a few synonyms to one group. Deliberately small. */
export function wordKey(w: string): string {
  let x = w.toLowerCase();
  for (const end of ["ing", "ed", "es", "s"]) if (x.length > end.length + 3 && x.endsWith(end)) { x = x.slice(0, -end.length); break; }
  const g = SYN.get(x) ?? SYN.get(`${x}e`); // "released" -> "releas" -> "release"
  return g === undefined ? x : `#${g}`;
}

const fuzzy = (code: string, start: number, end: number, quote: string): Finding => ({
  ...leak(code, start, end, quote), confidence: "medium", label: "needs_human_check",
  explanation: `This looks like a rewording of an internal-only fact (${code}): the same figure with related words. Check whether it should be public.`,
});

/**
 * A reworded leak: the fact's significant numbers appear in any digit notation ("12,000", "12k"; spelled-out numbers are not covered) and at
 * least a third of its other words appear in the same family or as a synonym, within the same stretch of text.
 * Medium confidence and "needs human check", because wording similarity is only a hint.
 */
function findRewordedLeaks(text: string, fact: InternalFact, taken: Finding[]): Finding[] {
  const toks = tokens(fact.statement);
  const figs = numbersIn(fact.statement).filter((n) => n.percent || n.value >= 100);
  const words = toks.filter((t) => !/^\d/.test(t) && t.length >= 3 && !STOP.has(t.toLowerCase()));
  if (!figs.length || !words.length) return [];
  const keys = new Set(words.map(wordKey));
  const nums = numbersIn(text);
  const out: Finding[] = [];
  for (const n of nums.filter((x) => x.value === figs[0].value && x.percent === figs[0].percent)) {
    if (taken.some((f) => n.start < f.end && n.end > f.start)) continue;
    const lo = Math.max(0, n.start - NEAR), hi = n.end + NEAR;
    if (!figs.slice(1).every((g) => nums.some((x) => x.value === g.value && x.start >= lo && x.end <= hi))) continue;
    const near = [...text.slice(lo, hi).matchAll(/\p{L}[\p{L}\d]*/gu)].filter((m) => keys.has(wordKey(m[0])));
    const hit = new Set(near.map((m) => wordKey(m[0])));
    if (hit.size < Math.max(1, Math.ceil(keys.size / 3))) continue;
    const spans = [{ start: n.start, end: n.end }, ...near.map((m) => ({ start: lo + m.index!, end: lo + m.index! + m[0].length }))];
    const start = Math.min(...spans.map((x) => x.start)), end = Math.max(...spans.map((x) => x.end));
    out.push(fuzzy(fact.code, start, end, text.slice(start, end)));
  }
  return out;
}

/**
 * Confidential Guard for internal FACTS (the codename check only knows terms). Public content only; the caller skips it
 * for internal audiences. Two ways to leak, both pure text matching:
 *  1. the fact's significant figures (for example 12000, 2027, 99.9%) appear together with at least half of the
 *     statement's other words, close to each other ("12000 customers by Q3");
 *  2. the fact starts with a name of two or more capitalised words ("Northbeam Mobile launches ...") that no public rule,
 *     fact or term mentions, and that name appears.
 * `publicText` is all public knowledge joined together; it decides whether a name is already public.
 * A third way catches rewording of the figure (12,000 / 12k) with related words, as a medium-confidence hint.
 * shortcut: a paraphrase with neither the figure nor the name is not caught (spelled-out numbers like "twelve thousand" too);
 * a semantic check would have to send internal facts to a model, which the product promises never to do.
 */
export function findInternalFactLeaks(text: string, facts: InternalFact[], publicText: string): Finding[] {
  const out: Finding[] = [];
  const pub = publicText.toLowerCase();
  for (const fact of facts) {
    const toks = tokens(fact.statement);
    const figs = toks.filter(significant);
    const words = toks.filter((t) => !/^\d/.test(t) && t.length >= 3 && !STOP.has(t.toLowerCase()));
    const found: Finding[] = [];

    if (figs.length) {
      for (const first of findFigure(text, figs[0])) {
        const near = text.slice(Math.max(0, first.start - NEAR), first.end + NEAR);
        const base = Math.max(0, first.start - NEAR);
        const rest = figs.slice(1).map((f) => findFigure(near, f)[0]);
        if (rest.some((m) => !m)) continue;
        const hit = words.map((w) => findTerm(near, w)[0]).filter((m): m is Match => !!m);
        if (hit.length < Math.max(1, Math.ceil(words.length / 2))) continue;
        const all = [first, ...rest.map((m) => ({ ...m!, start: m!.start + base, end: m!.end + base })), ...hit.map((m) => ({ ...m, start: m.start + base, end: m.end + base }))];
        const start = Math.min(...all.map((m) => m.start)), end = Math.max(...all.map((m) => m.end));
        found.push(leak(fact.code, start, end, text.slice(start, end)));
      }
    }

    const name = fact.statement.match(/^([A-Z][\w-]*(?:\s+[A-Z][\w-]*)+)/)?.[1];
    if (name && !pub.includes(name.toLowerCase())) {
      for (const m of findTerm(text, name)) {
        if (found.some((f) => m.start < f.end && m.end > f.start)) continue; // already inside a fuller finding
        found.push(leak(fact.code, m.start, m.end, m.quote));
      }
    }
    found.push(...findRewordedLeaks(text, fact, found));
    out.push(...found);
  }
  return out.sort((a, b) => a.start - b.start);
}

/** Replaces the given spans with "*" of the same length, so the model never sees a leaked fact and offsets still line up. */
export function maskSpans(text: string, spans: { start: number; end: number }[]): string {
  let out = text;
  for (const s of spans) if (s.start >= 0 && s.end > s.start) out = out.slice(0, s.start) + "*".repeat(s.end - s.start) + out.slice(s.end);
  return out;
}

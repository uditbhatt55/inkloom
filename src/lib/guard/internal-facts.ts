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

/**
 * Confidential Guard for internal FACTS (the codename check only knows terms). Public content only; the caller skips it
 * for internal audiences. Two ways to leak, both pure text matching:
 *  1. the fact's significant figures (for example 12000, 2027, 99.9%) appear together with at least half of the
 *     statement's other words, close to each other ("12000 customers by Q3");
 *  2. the fact starts with a name of two or more capitalised words ("Northbeam Mobile launches ...") that no public rule,
 *     fact or term mentions, and that name appears.
 * `publicText` is all public knowledge joined together; it decides whether a name is already public.
 * shortcut: wording that paraphrases a fact without its figures or name is not caught; the model never sees internal facts.
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

import type { Finding } from "@/lib/audit/types";
import { findTerm, maskTerms } from "@/lib/text/match";

export type InternalTerm = { code: string; term: string };

/**
 * Confidential Guard: runs BEFORE any AI call. Whole-word, case/spacing-insensitive (decision D2).
 * Only for public content; the caller must skip it for internal-audience items.
 * shortcut: no unicode normalisation (look-alike letters, zero-width chars), add NFKC folding if the eval set shows evasion.
 */
export function findLeaks(text: string, terms: InternalTerm[]): Finding[] {
  return terms.flatMap((t) =>
    findTerm(text, t.term).map<Finding>((m) => ({
      quote: m.quote, start: m.start, end: m.end,
      category: "confidentiality", severity: "critical", confidence: "high", source: "rule", ruleCode: t.code,
      explanation: "An internal-only term appears in public content.",
      suggestion: "Remove it, or use the public wording once the owner approves one.",
      status: "open", label: null,
    })),
  );
}

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE = /[+(]?\d[\d\s().-]{8,}\d/g;

const DATE_START = /^\d{4}-\d{2}-\d{2}(?!\d)/;

/**
 * Masks emails and phone-like numbers with "*" of the SAME length, so AI offsets still line up with the original text.
 * Privacy first: any run of 10 or more digits is masked (two numbers in a row, card numbers), except an ISO date such as "2026-11-12 10".
 */
export function maskPii(text: string): string {
  const stars = (m: string) => "*".repeat(m.length);
  return text.replace(EMAIL, stars).replace(PHONE, (m) => {
    const digits = m.replace(/\D/g, "").length;
    if (digits < 10) return m;
    if (DATE_START.test(m) && digits <= 12) return m;
    return stars(m);
  });
}

/** Everything that must not reach the model: personal data and the organisation's internal terms. Same length as the input. */
export function maskForAi(text: string, internalTerms: InternalTerm[]): string {
  return maskTerms(maskPii(text), internalTerms.map((t) => t.term));
}

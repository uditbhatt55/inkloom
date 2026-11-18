import type { Finding } from "@/lib/audit/types";
import { findTerm, maskTerms } from "@/lib/text/match";

export type InternalTerm = { code: string; term: string };

/**
 * Confidential Guard: runs BEFORE any AI call. Whole-word, case/spacing-insensitive (decision D2).
 * Only for public content; the caller must skip it for internal-audience items.
 * The matching (src/lib/text/match.ts) also sees through hidden-codename tricks: invisible characters (zero-width, soft hyphen),
 * Unicode dashes, full-width letters and Cyrillic/Greek lookalikes. It runs on the original text, so offsets stay valid.
 * shortcut: a fixed table of common lookalikes, not the full Unicode confusables list; extend it if the eval set shows a miss.
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

/**
 * Secrets and Indian identity numbers (Round 3, improvement 1). Aadhaar (12 digits) is already caught by the 10-digit rule
 * above; these are the patterns that have letters in them.
 * shortcut: well-known key prefixes and JWTs only, not every vendor's format; add a pattern when the eval set shows a miss.
 */
const SECRETS: { code: string; label: string; re: RegExp }[] = [
  { code: "GUARD-PAN", label: "a PAN (Indian tax ID)", re: /\b[A-Z]{3}[ABCFGHLJPTK][A-Z]\d{4}[A-Z]\b/g },
  { code: "GUARD-KEY", label: "an API key or access token", re: /\b(?:sk-(?:proj-)?[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{36,}|xox[abprs]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{35}|sk_live_[0-9a-zA-Z]{24,}|eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})/g },
];

/** Secrets in content are never sent to the model, and in public content they are a Critical leak. */
export function findSecrets(text: string): Finding[] {
  return SECRETS.flatMap((s) => [...text.matchAll(s.re)].map<Finding>((m) => ({
    quote: m[0], start: m.index!, end: m.index! + m[0].length,
    category: "confidentiality", severity: "critical", confidence: "high", source: "rule", ruleCode: s.code,
    explanation: `This looks like ${s.label}, which must never be published.`,
    suggestion: "Remove it. If it is a real key, revoke it and issue a new one.",
    status: "open", label: null,
  })));
}

const maskSecrets = (text: string) => SECRETS.reduce((t, s) => t.replace(s.re, (m) => "*".repeat(m.length)), text);

/** Everything that must not reach the model: personal data, secrets and the organisation's internal terms. Same length as the input. */
export function maskForAi(text: string, internalTerms: InternalTerm[]): string {
  return maskTerms(maskSecrets(maskPii(text)), internalTerms.map((t) => t.term));
}

/**
 * One finding per block of text that is in the page but hidden from readers (parsers/html.ts). It points at the block
 * in the audited text when it can be found there, otherwise it is a whole-document finding.
 */
export function hiddenTextFindings(content: string, hidden: { text: string; why: string }[]): Finding[] {
  return hidden.map<Finding>((h) => {
    const probe = h.text.slice(0, 60);
    const at = content.indexOf(probe);
    return {
      quote: at >= 0 ? probe : h.text.slice(0, 120), start: at, end: at >= 0 ? at + probe.length : -1,
      category: "confidentiality", severity: "major", confidence: "medium", source: "rule", ruleCode: "GUARD-HIDDEN",
      explanation: `This text is in the page but hidden from readers (${h.why}). Hidden text can carry wording nobody reviewed, and search engines may still read it.`,
      suggestion: "Remove it, or make it visible so it goes through review.",
      status: "open", label: null,
    };
  });
}

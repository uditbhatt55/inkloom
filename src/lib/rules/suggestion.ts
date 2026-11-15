import { findTerm } from "@/lib/text/match";

type TermRef = { term: string; kind: string };

/**
 * A model's suggested fix must not bring a banned term back or put an internal one into public copy (red-team review:
 * "suggested fixes introducing secondary violations"). Terms are matched with the same hidden-trick-proof matching as the
 * Confidential Guard. Returns the first offending term, or null when the text is clean.
 * `allowIn` is text that may already contain a banned term on purpose, such as the rule a rewrite is based on.
 */
export function forbiddenTermIn(text: string, terms: TermRef[], allowIn = ""): string | null {
  for (const t of terms) {
    if (t.kind === "internal" && findTerm(text, t.term).length) return t.term;
    if (t.kind === "banned" && findTerm(text, t.term).length && !findTerm(allowIn, t.term).length) return t.term;
  }
  return null;
}

/** A finding's suggested fix, or null when it would introduce a banned or internal term. */
export const safeSuggestion = (suggestion: string | null, terms: TermRef[]): string | null =>
  suggestion && forbiddenTermIn(suggestion, terms) === null ? suggestion : null;

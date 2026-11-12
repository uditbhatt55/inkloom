const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Whole-word, case-insensitive pattern; any run of spaces/hyphens/underscores between words (decision D2). */
export function termRegex(term: string): RegExp | null {
  const words = term.trim().split(/[\s\-_]+/).filter(Boolean);
  if (!words.length) return null;
  return new RegExp(`(?<![\\p{L}\\p{N}])${words.map(esc).join("[\\s\\-_]+")}(?![\\p{L}\\p{N}])`, "giu");
}

export type Match = { start: number; end: number; quote: string };

export function findTerm(text: string, term: string): Match[] {
  const re = termRegex(term);
  if (!re) return [];
  return [...text.matchAll(re)].map((m) => ({ start: m.index!, end: m.index! + m[0].length, quote: m[0] }));
}

/** Replaces every whole-word match of each term with "*" of the same length, so offsets stay valid. */
export function maskTerms(text: string, terms: string[]): string {
  let out = text;
  for (const t of terms) for (const m of findTerm(out, t)) out = out.slice(0, m.start) + "*".repeat(m.end - m.start) + out.slice(m.end);
  return out;
}

/**
 * A figure such as "99.9%" must not match inside "99.99%", "199.9%" or "99.9.1", and "10" must not match inside "10.2".
 * A sentence-ending "." or "," right after the figure is fine.
 */
export function findFigure(text: string, figure: string): Match[] {
  const re = new RegExp(`(?<!\\d)(?<!\\d[.,])${esc(figure)}(?!\\d|[.,]\\d)`, "g");
  return [...text.matchAll(re)].map((m) => ({ start: m.index!, end: m.index! + m[0].length, quote: m[0] }));
}

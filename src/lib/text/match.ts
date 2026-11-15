const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Characters that show nothing: zero-width space/joiners, left-to-right marks, word joiner, BOM, soft hyphen, bidi controls.
 * Someone can hide a codename in "Pro<U+200B>ject" and a person still reads "Project".
 */
const INVISIBLE = "\\u00AD\\u180E\\u200B-\\u200F\\u202A-\\u202E\\u2060-\\u2064\\uFEFF";
const GAP = `[${INVISIBLE}]*`;
// space, hyphen, underscore, the Unicode dashes and the minus sign, with invisible characters mixed in
const SEPARATOR = `[\\s\\-_\\u2010-\\u2015\\u2212${INVISIBLE}]+`;

/** Cyrillic and Greek letters that look like a Latin letter (lower case; the "i" flag folds the upper case). */
const LOOKALIKES: Record<string, string> = {
  a: "\\u0430\\u03B1", c: "\\u0441\\u03F2", e: "\\u0435\\u03B5", h: "\\u04BB", i: "\\u0456\\u03B9\\u04CF", j: "\\u0458",
  k: "\\u03BA", m: "\\u043C", n: "\\u03B7", o: "\\u043E\\u03BF\\u0585", p: "\\u0440\\u03C1", s: "\\u0455", t: "\\u0442\\u03C4",
  v: "\\u03BD", x: "\\u0445\\u03C7", y: "\\u0443\\u03B3", b: "\\u0432", d: "\\u0501", g: "\\u0261", l: "\\u04CF", u: "\\u03C5", w: "\\u0461", z: "\\u0290",
};

/** One character of a term: itself, its full-width form (U+FF21..FF5A, U+FF10..FF19) and any lookalike letters. */
function glyph(ch: string): string {
  const alts: string[] = [];
  if (/[a-z]/i.test(ch)) {
    alts.push(String.fromCharCode(ch.charCodeAt(0) + 0xfee0));
    const lookalike = LOOKALIKES[ch.toLowerCase()];
    if (lookalike) alts.push(lookalike);
  } else if (/\d/.test(ch)) alts.push(String.fromCharCode(ch.charCodeAt(0) + 0xfee0));
  return alts.length ? `[${esc(ch).replace(/[\]\\^-]/g, "\\$&")}${alts.join("")}]` : esc(ch);
}

/**
 * Whole-word, case-insensitive pattern; any run of spaces/hyphens/underscores between words (decision D2).
 * It also sees through invisible characters inside the term, Unicode dashes, full-width letters and Cyrillic/Greek
 * lookalikes. Nothing is rewritten, the pattern runs on the original text, so match offsets stay valid for the AI step.
 */
export function termRegex(term: string): RegExp | null {
  const words = term.trim().split(/[\s\-_]+/).filter(Boolean);
  if (!words.length) return null;
  const word = (w: string) => [...w].map(glyph).join(GAP);
  return new RegExp(`(?<![\\p{L}\\p{N}])${words.map(word).join(SEPARATOR)}(?![\\p{L}\\p{N}])`, "giu");
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

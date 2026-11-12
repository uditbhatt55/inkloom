import { differenceCiede2000, converter, parse } from "culori";
import type { Confidence, Finding } from "@/lib/audit/types";

const base = { source: "rule", status: "open", label: null, suggestion: null, start: -1, end: -1 } as const;
const toLch = converter("lch");
const deltaE = differenceCiede2000();

/* ------------------------------------------------------------------ palette */

export type PaletteColour = { name: string; hex: string };
export type ImageColour = { hex: string; /** share of the image's pixels, 0..1 */ share: number };

/**
 * Off-palette colours in an image (proposal §7.1, §9 "palette distance").
 * A dominant colour is on-brand when its CIEDE2000 distance to the nearest palette colour is <= maxDeltaE.
 * Neutrals (very low chroma: whites, greys, blacks) and colours under `minShare` of the image are ignored,
 * because backgrounds and anti-aliasing are not brand choices. Extracted colours give medium confidence (decision D4).
 */
export function checkPalette(
  colours: ImageColour[], palette: PaletteColour[],
  opts: { maxDeltaE?: number; minShare?: number; confidence?: Confidence; label?: string } = {},
): Finding[] {
  const { maxDeltaE = 10, minShare = 0.08, confidence = "medium", label = "Image" } = opts;
  if (!palette.length) return [];
  const brand = palette.map((p) => ({ ...p, c: parse(p.hex) })).filter((p) => p.c);
  const out: Finding[] = [];
  for (const col of colours) {
    if (col.share < minShare) continue;
    const c = parse(col.hex);
    if (!c) continue;
    const lch = toLch(c);
    if ((lch?.c ?? 0) < 8) continue; // neutral
    let best = brand[0], bestD = Infinity;
    for (const p of brand) {
      const d = deltaE(c, p.c!);
      if (d < bestD) { bestD = d; best = p; }
    }
    if (bestD <= maxDeltaE) continue;
    out.push({
      ...base, quote: `${label}: ${col.hex.toLowerCase()} (${Math.round(col.share * 100)}% of the image)`,
      category: "visual", severity: "minor", confidence, ruleCode: "BRAND-PALETTE",
      explanation: `${col.hex.toLowerCase()} is not a brand colour. The nearest palette colour is ${best.name} (${best.hex.toLowerCase()}), ΔE ${bestD.toFixed(1)}; on-brand colours are within ΔE ${maxDeltaE}.`,
    });
  }
  return out;
}

/* -------------------------------------------------------------------- fonts */

export type ApprovedFont = { name: string };

/** "ABCDEF+Inter-SemiBold" -> "inter", "Arial,Bold" -> "arial", "Helvetica Neue LT Std" stays a family. */
export function fontFamily(name: string): string {
  return name
    .replace(/^[A-Z]{6}\+/, "") // PDF subset prefix
    .split(/[,]/)[0]
    .replace(/[-_ ]?(thin|extralight|ultralight|light|regular|book|medium|semibold|demibold|bold|extrabold|ultrabold|black|heavy|italic|oblique|condensed|narrow|mt|ps|psmt)\b/gi, "")
    .replace(/[\s\-_]+/g, " ")
    .trim()
    .toLowerCase();
}

/** Symbol/dingbat fonts draw bullets, arrows and icons, not brand typography, so they are never flagged. */
const SYMBOL_FONT = /^(symbol|wingdings( \d)?|webdings|zapf ?dingbats|dingbats|marlett|mt extra|segoe ui (symbol|emoji)|segoe mdl2 assets|segoe fluent icons|font awesome.*|material (icons|symbols).*)$/;

/** Fonts used in a PDF/DOCX that are not approved (proposal §7.1). Font names are read from the file, so confidence is high. */
export function checkFonts(used: string[], approved: ApprovedFont[]): Finding[] {
  if (!approved.length) return [];
  const ok = new Set(approved.map((f) => fontFamily(f.name)));
  const seen = new Set<string>();
  const out: Finding[] = [];
  for (const u of used) {
    const fam = fontFamily(u);
    if (!fam || ok.has(fam) || seen.has(fam) || SYMBOL_FONT.test(fam)) continue;
    seen.add(fam);
    out.push({
      ...base, quote: `Font: ${u}`, category: "visual", severity: "minor", confidence: "high", ruleCode: "BRAND-FONTS",
      explanation: `"${u}" is not an approved brand font. Approved: ${approved.map((f) => f.name).join(", ")}.`,
    });
  }
  return out;
}

/* ----------------------------------------------------------------- alt text */

export type ImageRef = { label: string; /** null = no alt attribute / description at all; "" = marked decorative */ alt: string | null };

const PLACEHOLDER = /^(image|img|photo|picture|pic|graphic|logo|banner|icon|screenshot|untitled|alt|placeholder)( \d+)?$|^(image|photo|picture) of$|\.(png|jpe?g|gif|webp|svg|bmp)$|^(img|dsc|image|screenshot)[_\- ]?\d+/i;

/**
 * WCAG 2.2 SC 1.1.1. Missing alt text is Major; a placeholder ("image", "IMG_2041.jpg") is Minor.
 * An explicitly empty alt marks a decorative image and is fine.
 */
export function checkAltText(images: ImageRef[]): Finding[] {
  const out: Finding[] = [];
  for (const img of images) {
    if (img.alt === "") continue;
    const alt = img.alt?.trim() ?? null;
    if (alt === null || alt === "") {
      out.push({
        ...base, quote: `${img.label}: no alt text`, category: "accessibility", severity: "major", confidence: "high", ruleCode: "WCAG-1.1.1",
        explanation: "This image has no text alternative, so screen-reader users miss it. Describe what the image shows or why it is there.",
      });
    } else if (PLACEHOLDER.test(alt)) {
      out.push({
        ...base, quote: `${img.label}: alt="${alt}"`, category: "accessibility", severity: "minor", confidence: "high", ruleCode: "WCAG-1.1.1",
        explanation: `"${alt}" is a placeholder, not a description. Say what the image shows or why it is there.`,
      });
    }
  }
  return out;
}

/* -------------------------------------------------------------- readability */

export function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;
  const trimmed = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, "");
  return Math.max(1, (trimmed.match(/[aeiouy]{1,2}/g) ?? []).length);
}

/** Flesch–Kincaid grade level. Returns null for text too short to measure (< 30 words). */
export function readingGrade(text: string): number | null {
  const words = text.match(/[A-Za-z]+(?:'[A-Za-z]+)?/g) ?? [];
  if (words.length < 30) return null;
  const sentences = Math.max(1, (text.match(/[^.!?]+[.!?]+/g) ?? [text]).length);
  const syllables = words.reduce((n, w) => n + countSyllables(w), 0);
  return 0.39 * (words.length / sentences) + 11.8 * (syllables / words.length) - 15.59;
}

/** Text harder than the target grade for its channel. Medium confidence: the formula is an estimate. */
export function checkReadability(text: string, maxGrade = 12): Finding[] {
  const g = readingGrade(text);
  if (g === null || g <= maxGrade) return [];
  return [{
    ...base, quote: `Reading grade ${g.toFixed(1)}`, category: "accessibility", severity: "minor", confidence: "medium", ruleCode: "READABILITY",
    explanation: `The text reads at about US grade ${g.toFixed(1)} (Flesch–Kincaid); the target for this channel is ${maxGrade} or lower. Shorter sentences and plainer words help.`,
  }];
}

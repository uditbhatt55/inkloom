import type { Confidence, Finding } from "@/lib/audit/types";

function channel(c: number) {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function parseHex(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`Invalid hex colour: ${hex}`);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function luminance(hex: string): number {
  const [r, g, b] = parseHex(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** WCAG 2.2 SC 1.4.3: 4.5:1 normal text, 3:1 large text. The raw ratio is compared, never a rounded one (4.49 fails). */
export function checkContrast(fg: string, bg: string, large = false) {
  const ratio = contrastRatio(fg, bg);
  const required = large ? 3 : 4.5;
  return { ratio, required, passes: ratio >= required };
}

/**
 * `confidence`: "high" when the creator gave the exact colours, "medium" when they were extracted from the image (decision D4).
 */
export function contrastFinding(o: { fg: string; bg: string; label: string; large?: boolean; confidence: Confidence }): Finding | null {
  const { ratio, required, passes } = checkContrast(o.fg, o.bg, o.large);
  if (passes) return null;
  return {
    quote: `${o.label}: ${o.fg} on ${o.bg}`, start: -1, end: -1,
    category: "accessibility", severity: "major", confidence: o.confidence, source: "rule", ruleCode: "WCAG-1.4.3",
    explanation: `Contrast ratio is ${ratio.toFixed(2)}:1; WCAG 2.2 AA needs at least ${required}:1 for ${o.large ? "large" : "normal"} text.`,
    suggestion: null, status: "open", label: null,
  };
}

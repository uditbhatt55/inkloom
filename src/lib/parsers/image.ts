import sharp, { type Metadata } from "sharp";
import type { ImageColour } from "@/lib/rules/visual";
import { empty, ParseError, type ParsedContent } from "@/lib/parsers/types";

const hex = (r: number, g: number, b: number) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;

/**
 * Dominant colours with their share of pixels. The image is shrunk to 96px, each pixel is bucketed to 8 levels per channel,
 * and each bucket reports its mean colour. Deterministic, so the same image always gives the same findings.
 */
export async function dominantColours(bytes: Uint8Array, max = 6, minShare = 0.02): Promise<ImageColour[]> {
  const { data, info } = await sharp(bytes).flatten({ background: "#ffffff" }).resize(96, 96, { fit: "inside" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
  const total = info.width * info.height;
  for (let i = 0; i < data.length; i += info.channels) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const key = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5);
    const bk = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    bk.n++; bk.r += r; bk.g += g; bk.b += b;
    buckets.set(key, bk);
  }
  return [...buckets.values()]
    .sort((a, b) => b.n - a.n)
    .slice(0, max)
    .map((bk) => ({ hex: hex(bk.r / bk.n, bk.g / bk.n, bk.b / bk.n), share: bk.n / total }))
    .filter((c) => c.share >= minShare);
}

/**
 * An image upload. It has no text and no alt text of its own: the creator types the alt text (and optionally the exact
 * text/background colours) on the upload form, and they are passed in here (§7.1, decision D4).
 */
export async function parseImage(bytes: Uint8Array, opts: { altText?: string | null; label?: string } = {}): Promise<ParsedContent> {
  let meta: Metadata;
  try {
    meta = await sharp(bytes).metadata();
  } catch {
    throw new ParseError("invalid", "This image could not be read.");
  }
  if (!meta.width || !meta.height || meta.width * meta.height > 40_000_000) throw new ParseError("too_large", "This image is too large to audit.");
  const out = empty("image", "");
  out.meta = { width: meta.width, height: meta.height };
  out.colours = await dominantColours(bytes);
  out.textPair = await textColourPair(bytes).catch(() => null);
  out.images = [{ label: opts.label ?? "Uploaded image", alt: opts.altText === undefined ? null : opts.altText }];
  return out;
}

export type TextPair = { fg: string; bg: string; /** share of the image the foreground colour covers, 0..1 */ share: number; /** thin, edge-rich shapes, like text or line art, rather than a flat block */ strokeLike: boolean };

const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/**
 * Best guess of "foreground colour on background colour" without reading the text (no OCR). The background is the most
 * common colour. Every other solid colour with a real share of the image is a foreground colour (text, icon, logo); colours
 * that only lie on the line between the background and a stronger colour are anti-aliasing, not choices, and are skipped.
 * The pair returned is the foreground that has the LOWEST contrast on that background, because that is the one a reader
 * will fail to see. The caller keeps it LOW confidence either way (decision D4, D24): it is a guess, not a measurement.
 * shortcut: no OCR, so a low-contrast icon or logo is reported like low-contrast text; it stays below "high" and the
 * explanation tells the person to type the exact colours for a precise check.
 */
export async function textColourPair(bytes: Uint8Array, minShare = 0.004): Promise<TextPair | null> {
  const { data, info } = await sharp(bytes).flatten({ background: "#ffffff" }).resize(512, 512, { fit: "inside", withoutEnlargement: true }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: c } = info;
  const key = (i: number) => ((data[i] >> 5) << 6) | ((data[i + 1] >> 5) << 3) | (data[i + 2] >> 5);
  const sum = new Map<number, { n: number; r: number; g: number; b: number; edge: number }>();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * c, k = key(i);
      const s = sum.get(k) ?? { n: 0, r: 0, g: 0, b: 0, edge: 0 };
      s.n++; s.r += data[i]; s.g += data[i + 1]; s.b += data[i + 2];
      sum.set(k, s);
      for (const j of [x + 1 < w ? i + c : -1, y + 1 < h ? i + w * c : -1]) {
        if (j < 0 || key(j) === k) continue;
        s.edge++;
        const o = sum.get(key(j)) ?? { n: 0, r: 0, g: 0, b: 0, edge: 0 };
        o.edge++; sum.set(key(j), o);
      }
    }
  }
  const total = w * h;
  const cols = [...sum.values()].map((v) => ({ rgb: [v.r / v.n, v.g / v.n, v.b / v.n], share: v.n / total, edgeRatio: v.edge / v.n })).sort((a, b) => b.share - a.share);
  const bg = cols[0];
  if (!bg) return null;
  const accepted: typeof cols = [];
  for (const col of cols.slice(1)) {
    if (col.share < minShare) continue;
    const isBlend = [bg, ...accepted].some((f) => {
      if (f === bg) return accepted.some((a) => blendOf(col.rgb, bg.rgb, a.rgb));
      return blendOf(col.rgb, bg.rgb, f.rgb);
    });
    if (!isBlend) accepted.push(col);
  }
  const lum = (rgb: number[]) => rgb.reduce((a, v, i) => a + (i === 0 ? 0.2126 : i === 1 ? 0.7152 : 0.0722) * (v / 255 <= 0.03928 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4), 0);
  const ratio = (a: number[], b: number[]) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const worst = accepted.sort((a, b) => ratio(a.rgb, bg.rgb) - ratio(b.rgb, bg.rgb))[0];
  if (!worst) return null;
  const hexOf = (rgb: number[]) => hex(rgb[0], rgb[1], rgb[2]);
  return { fg: hexOf(worst.rgb), bg: hexOf(bg.rgb), share: Math.round(worst.share * 1000) / 1000, strokeLike: worst.edgeRatio >= 0.3 };
}

/** Is `col` (about) a mix of `bg` and `fg`: close to the line between them, strictly between? */
function blendOf(col: number[], bg: number[], fg: number[]): boolean {
  const d = dist(bg, fg);
  if (d < 1) return false;
  const t = ((col[0] - bg[0]) * (fg[0] - bg[0]) + (col[1] - bg[1]) * (fg[1] - bg[1]) + (col[2] - bg[2]) * (fg[2] - bg[2])) / (d * d);
  if (t <= 0.05 || t >= 0.95) return false;
  return dist(col, [bg[0] + t * (fg[0] - bg[0]), bg[1] + t * (fg[1] - bg[1]), bg[2] + t * (fg[2] - bg[2])]) < 16;
}

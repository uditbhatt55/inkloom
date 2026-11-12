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
  out.images = [{ label: opts.label ?? "Uploaded image", alt: opts.altText === undefined ? null : opts.altText }];
  return out;
}

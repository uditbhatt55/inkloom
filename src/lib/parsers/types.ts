import type { ImageColour, ImageRef } from "@/lib/rules/visual";

export type ContentKind = "text" | "pdf" | "docx" | "html" | "image";

/** What every parser returns. `text` is what gets stored as the version text; all finding offsets point into it. */
export type ParsedContent = {
  kind: ContentKind;
  text: string;
  /** font names as written in the file (PDF BaseFont, DOCX rFonts) */
  fonts: string[];
  /** images with their alt text / description, for the WCAG 1.1.1 check */
  images: ImageRef[];
  /** dominant colours with pixel share, for palette and contrast checks (images only) */
  colours: ImageColour[];
  meta: { pages?: number; width?: number; height?: number; url?: string };
  warnings: string[];
};

export type ParseErrorCode = "too_large" | "unsupported" | "no_text_layer" | "invalid" | "fetch_blocked" | "fetch_failed";

/** Errors with a fixed, user-safe message. Never put library error text in `message`. */
export class ParseError extends Error {
  constructor(public code: ParseErrorCode, message: string) {
    super(message);
    this.name = "ParseError";
  }
}

export const LIMITS = {
  fileBytes: 10 * 1024 * 1024,
  htmlBytes: 2 * 1024 * 1024,
  textChars: 200_000,
  fetchTimeoutMs: 10_000,
  maxRedirects: 3,
} as const;

export const empty = (kind: ContentKind, text: string): ParsedContent => ({ kind, text, fonts: [], images: [], colours: [], meta: {}, warnings: [] });

/** Normalise line endings and trim to the size limit, so stored text and offsets agree. */
export function normaliseText(s: string, warnings: string[]): string {
  let t = s.replace(/\r\n?/g, "\n").replace(/\u0000/g, "");
  if (t.length > LIMITS.textChars) {
    t = t.slice(0, LIMITS.textChars);
    warnings.push(`Only the first ${LIMITS.textChars.toLocaleString("en")} characters were audited.`);
  }
  return t;
}

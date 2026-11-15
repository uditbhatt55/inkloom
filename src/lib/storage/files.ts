import type { ContentKind } from "@/lib/parsers/types";

export const CONTENT_BUCKET = "content-files";
export const LOGO_BUCKET = "brand-assets";
/** Logos are small raster images. SVG is not accepted: it can carry script. */
export const LOGO_MAX_BYTES = 2 * 1024 * 1024;

/** A file name that is safe inside a storage path: no folders, no spaces or odd characters, at most 80 characters. */
export function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const clean = base.normalize("NFKD").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^[.-]+/, "").replace(/-{2,}/g, "-");
  const cut = clean.length > 80 ? `${clean.slice(0, 60)}${clean.slice(clean.lastIndexOf(".") > 60 ? clean.lastIndexOf(".") : clean.length)}`.slice(0, 80) : clean;
  return cut || "file";
}

export const contentFilePath = (orgId: string, versionId: string, name: string) => `${orgId}/${versionId}/${safeFileName(name)}`;
export const logoPath = (orgId: string, assetId: string, name: string) => `${orgId}/${assetId}/${safeFileName(name)}`;

/** Image type from the bytes (never from the file name or the browser's claim): png, jpeg or webp, else null. */
export function imageMime(b: Uint8Array): "image/png" | "image/jpeg" | "image/webp" | null {
  const at = (o: number, s: string) => [...s].every((c, i) => b[o + i] === c.charCodeAt(0));
  if (b[0] === 0x89 && at(1, "PNG")) return "image/png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (at(0, "RIFF") && at(8, "WEBP")) return "image/webp";
  return null;
}

/** MIME type to store with an uploaded original, from what the parser found in the bytes. */
export function originalMime(kind: ContentKind, bytes: Uint8Array): string {
  switch (kind) {
    case "pdf": return "application/pdf";
    case "docx": return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "image": return imageMime(bytes) ?? "application/octet-stream";
    case "html": return "text/html";
    default: return "text/plain";
  }
}

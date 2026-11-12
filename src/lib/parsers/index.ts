import { parseDocx } from "@/lib/parsers/docx";
import { parseHtmlContent } from "@/lib/parsers/html";
import { parseImage } from "@/lib/parsers/image";
import { parsePdf } from "@/lib/parsers/pdf";
import { empty, LIMITS, normaliseText, ParseError, type ContentKind, type ParsedContent } from "@/lib/parsers/types";

export { fetchPage } from "@/lib/parsers/html";
export { ParseError, type ParsedContent } from "@/lib/parsers/types";

/** File type from the bytes, never from the file name or the browser's MIME type. */
export function sniff(bytes: Uint8Array): ContentKind | null {
  const b = bytes;
  const ascii = (o: number, s: string) => [...s].every((c, i) => b[o + i] === c.charCodeAt(0));
  if (ascii(0, "%PDF-")) return "pdf";
  if (b[0] === 0x89 && ascii(1, "PNG")) return "image";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image";
  if (ascii(0, "RIFF") && ascii(8, "WEBP")) return "image";
  if (ascii(0, "PK\u0003\u0004")) return "docx"; // confirmed by the DOCX parser (word/document.xml must exist)
  const head = new TextDecoder("utf-8", { fatal: false }).decode(b.subarray(0, 2048));
  if (head.includes("\u0000")) return null;
  return /^\s*(<!doctype html|<html[\s>])/i.test(head) ? "html" : "text";
}

/** Entry point for uploads (§5.1, §7.1). Pasted text goes through here too, as UTF-8 bytes. */
export async function parseUpload(bytes: Uint8Array, opts: { altText?: string | null; label?: string } = {}): Promise<ParsedContent> {
  if (bytes.byteLength === 0) throw new ParseError("invalid", "The file is empty.");
  if (bytes.byteLength > LIMITS.fileBytes) throw new ParseError("too_large", "Files over 10 MB are not supported.");
  switch (sniff(bytes)) {
    case "pdf": return parsePdf(bytes);
    case "docx": return parseDocx(bytes);
    case "image": return parseImage(bytes, opts);
    case "html": return parseHtmlContent(new TextDecoder().decode(bytes));
    case "text": {
      const out = empty("text", "");
      out.text = normaliseText(new TextDecoder().decode(bytes), out.warnings);
      if (!out.text.trim()) throw new ParseError("invalid", "The file is empty.");
      return out;
    }
    default: throw new ParseError("unsupported", "This file type is not supported. Upload text, PDF, Word (.docx), PNG, JPG or WebP.");
  }
}

import { inflateSync } from "node:zlib";
import { extractText, getDocumentProxy } from "unpdf";
import { empty, normaliseText, ParseError, type ParsedContent } from "@/lib/parsers/types";

/**
 * Font names as written in the file (`/BaseFont /ABCDEF+Inter-Bold`). pdf.js only exposes substitute fonts,
 * so the names are read from the raw bytes, including Flate-compressed object streams where modern PDFs keep font dictionaries.
 */
export function pdfFontNames(bytes: Uint8Array): string[] {
  const raw = Buffer.from(bytes);
  const chunks = [raw.toString("latin1")];
  const re = /\/Type\s*\/ObjStm[\s\S]{0,400}?stream\r?\n/g;
  for (let m = re.exec(chunks[0]); m; m = re.exec(chunks[0])) {
    const start = m.index + m[0].length;
    const end = chunks[0].indexOf("endstream", start);
    if (end < 0 || !/\/FlateDecode/.test(m[0])) continue;
    try {
      chunks.push(inflateSync(raw.subarray(start, end)).toString("latin1"));
    } catch {
      // damaged stream: skip, text extraction still works
    }
  }
  const names = new Set<string>();
  for (const c of chunks) for (const f of c.matchAll(/\/BaseFont\s*\/([^\s/<>[\]()]+)/g)) names.add(f[1].replace(/#([0-9a-f]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16))));
  return [...names];
}

/** PDF → text (pages joined by a blank line) + font names. A PDF with no text layer (scanned) is rejected (§7.1). */
export async function parsePdf(bytes: Uint8Array): Promise<ParsedContent> {
  let pages: string[];
  try {
    const doc = await getDocumentProxy(new Uint8Array(bytes));
    pages = (await extractText(doc, { mergePages: false })).text as string[];
  } catch {
    throw new ParseError("invalid", "This PDF could not be read. It may be damaged or password-protected.");
  }
  const out = empty("pdf", "");
  out.text = normaliseText(pages.map((p) => p.trim()).join("\n\n"), out.warnings);
  if (out.text.replace(/\s/g, "").length < 20) {
    throw new ParseError("no_text_layer", "This PDF has no text layer (it looks scanned). Scanned PDFs are not supported yet; upload the original document.");
  }
  out.fonts = pdfFontNames(bytes);
  out.meta.pages = pages.length;
  return out;
}

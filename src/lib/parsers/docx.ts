import JSZip from "jszip";
import mammoth from "mammoth";
import { parse as parseHtml } from "node-html-parser";
import type { ImageRef } from "@/lib/rules/visual";
import { empty, normaliseText, ParseError, type ParsedContent } from "@/lib/parsers/types";

const attr = (tag: string, name: string) => {
  const m = new RegExp(`\\b${name}="([^"]*)"`).exec(tag);
  return m ? parseHtml(m[1]).text : null; // decode XML entities
};

/** Fonts named in document.xml and styles.xml (w:rFonts ascii/hAnsi/cs), excluding theme references. */
function docxFonts(xml: string): string[] {
  const out = new Set<string>();
  for (const m of xml.matchAll(/<w:rFonts\b[^>]*>/g)) {
    for (const a of ["w:ascii", "w:hAnsi", "w:cs"]) {
      const v = attr(m[0], a);
      if (v) out.add(v);
    }
  }
  return [...out];
}

/**
 * Images and their alt text: Word stores it as `descr` on <wp:docPr>. No descr = missing (null);
 * an image marked decorative (adec:decorative val="1") counts as "" (decorative, fine).
 */
function docxImages(xml: string): ImageRef[] {
  const out: ImageRef[] = [];
  for (const d of xml.matchAll(/<wp:docPr\b[^>]*?(?:\/>|>[\s\S]*?<\/wp:docPr>)/g)) {
    const tag = d[0];
    const decorative = /<adec:decorative\b[^>]*\bval="1"/.test(tag);
    const descr = attr(tag, "descr");
    out.push({ label: attr(tag, "name") || `Image ${out.length + 1}`, alt: decorative ? "" : descr && descr.trim() ? descr : null });
  }
  return out;
}

export async function parseDocx(bytes: Uint8Array): Promise<ParsedContent> {
  let zip: JSZip;
  let text: string;
  try {
    const buf = Buffer.from(bytes);
    zip = await JSZip.loadAsync(buf);
    text = (await mammoth.extractRawText({ buffer: buf })).value;
  } catch {
    throw new ParseError("invalid", "This Word file could not be read. Save it again as .docx and retry.");
  }
  const doc = (await zip.file("word/document.xml")?.async("string")) ?? "";
  const styles = (await zip.file("word/styles.xml")?.async("string")) ?? "";
  const out = empty("docx", "");
  out.text = normaliseText(text.replace(/\n{3,}/g, "\n\n").trim(), out.warnings);
  out.fonts = [...new Set([...docxFonts(doc), ...docxFonts(styles)])];
  out.images = docxImages(doc);
  return out;
}

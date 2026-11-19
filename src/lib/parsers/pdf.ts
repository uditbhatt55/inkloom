import { inflateSync } from "node:zlib";
import { extractText, getDocumentProxy, getResolvedPDFJS } from "unpdf";
import { empty, normaliseText, ParseError, type ParsedContent } from "@/lib/parsers/types";

/**
 * Font names from the file (`/BaseFont /ABCDEF+Inter-Bold` → `Inter-Bold`). pdf.js only exposes substitute fonts,
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
  // the six-letter subset tag ("ABCDEF+") is not part of the font's name, and two subsets of one font are one font
  for (const c of chunks) for (const f of c.matchAll(/\/BaseFont\s*\/([^\s/<>[\]()]+)/g)) names.add(f[1].replace(/#([0-9a-f]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16))).replace(/^[A-Z]{6}\+/, ""));
  return [...names];
}

type PdfDoc = Awaited<ReturnType<typeof getDocumentProxy>>;
type Hidden = { text: string; why: string };

/**
 * Text that is in the PDF (so it is extracted and audited) but a reader cannot see (Round 3, improvement 1):
 * invisible text mode (Tr 3 or 7), white text on a page with nothing painted under it yet, or a size below 1 pt.
 * shortcut: white text is only flagged while the page has no image and no non-white filled shape, because white text
 * on a coloured banner is normal design; white-on-white drawn over a white box is missed. Covers RGB/gray fills only.
 */
export async function pdfHiddenText(doc: PdfDoc): Promise<Hidden[]> {
  const { OPS } = await getResolvedPDFJS();
  const show = new Set([OPS.showText, OPS.showSpacedText, OPS.nextLineShowText, OPS.nextLineSetSpacingShowText]);
  const fills = new Set([OPS.fill, OPS.eoFill, OPS.fillStroke, OPS.eoFillStroke, OPS.closeFillStroke, OPS.closeEOFillStroke]);
  const images = new Set([OPS.paintImageXObject, OPS.paintInlineImageXObject, OPS.paintImageMaskXObject, OPS.shadingFill]);
  const out: Hidden[] = [];
  let cur: Hidden | null = null;
  const flush = () => {
    const text = cur?.text.replace(/\s+/g, " ").trim() ?? "";
    if (cur && text.length >= 3) out.push({ text: text.slice(0, 500), why: cur.why });
    cur = null;
  };
  const add = (text: string, why: string | null) => {
    if (!why) {
      if (text.trim()) flush();
    } else if (cur?.why === why) cur.text += text;
    else {
      flush();
      cur = { text, why };
    }
  };

  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const { fnArray, argsArray } = await page.getOperatorList();
    const stack: { mode: number; fill: string }[] = [];
    let st = { mode: 0, fill: "#000000" };
    let painted = false; // something non-white is under later text, so white text may be on a coloured background
    fnArray.forEach((fn, i) => {
      const a = argsArray[i];
      if (fn === OPS.save) stack.push({ ...st });
      else if (fn === OPS.restore) st = stack.pop() ?? st;
      else if (fn === OPS.setTextRenderingMode) st = { ...st, mode: a[0] };
      else if (fn === OPS.setFillRGBColor) st = { ...st, fill: String(a[0]).toLowerCase() };
      else if (fn === OPS.setFillColor || fn === OPS.setFillColorN || fn === OPS.setFillColorSpace) st = { ...st, fill: "other" };
      else if (images.has(fn) || ((fills.has(fn) || (fn === OPS.constructPath && fills.has(a[0]))) && st.fill !== "#ffffff")) painted = true;
      else if (show.has(fn)) {
        const glyphs: unknown[] = a.find(Array.isArray) ?? [];
        const text = glyphs.map((g) => (typeof g === "number" ? (g < -200 ? " " : "") : ((g as { unicode?: string })?.unicode ?? ""))).join("");
        add(text, st.mode === 3 || st.mode === 7 ? "invisible text mode" : st.fill === "#ffffff" && !painted ? "white text on a white page" : null);
      }
    });
    flush();
    // size from the full transform (font size × text matrix × page transform), as the reader would see it
    for (const it of (await page.getTextContent()).items) {
      if (!("str" in it)) continue;
      add(it.str + (it.hasEOL ? " " : ""), Math.hypot(it.transform[2], it.transform[3]) < 1 && it.str.trim() ? "text smaller than 1 pt" : null);
    }
    flush();
  }
  return out;
}

/** PDF → text (pages joined by a blank line) + font names. A PDF with no text layer (scanned) is rejected (§7.1). */
export async function parsePdf(bytes: Uint8Array): Promise<ParsedContent> {
  let pages: string[];
  let hidden: Hidden[] = [];
  try {
    const doc = await getDocumentProxy(new Uint8Array(bytes));
    pages = (await extractText(doc, { mergePages: false })).text as string[];
    hidden = await pdfHiddenText(doc).catch(() => []); // a failed check must not block the audit of the visible text
  } catch {
    throw new ParseError("invalid", "This PDF could not be read. It may be damaged or password-protected.");
  }
  const out = empty("pdf", "");
  out.text = normaliseText(pages.map((p) => p.trim()).join("\n\n"), out.warnings);
  if (out.text.replace(/\s/g, "").length < 20) {
    throw new ParseError("no_text_layer", "This PDF has no text layer (it looks scanned). Scanned PDFs are not supported yet; upload the original document.");
  }
  out.fonts = pdfFontNames(bytes);
  out.hidden = hidden;
  if (hidden.length) out.warnings.push(`${hidden.length} block${hidden.length === 1 ? " of text is" : "s of text are"} in the file but hidden from readers; they are audited and flagged.`);
  out.meta.pages = pages.length;
  // where each page starts in the joined text (pages are joined by a blank line), so a quote can be traced to its page
  const starts: number[] = [];
  let at = 0;
  for (const p of pages) {
    starts.push(at);
    at += p.trim().length + 2;
  }
  out.meta.pageStarts = starts.filter((s) => s <= out.text.length);
  return out;
}

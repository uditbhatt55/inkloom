import JSZip from "jszip";
import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";
import { minimalPdf } from "../../../tests/fixtures/make-pdf";
import { fetchPage, isPrivateAddress, parseHtmlContent } from "./html";
import { dominantColours } from "./image";
import { parseUpload, sniff } from "./index";
import { pdfFontNames } from "./pdf";
import { ParseError } from "./types";

const enc = (s: string) => new TextEncoder().encode(s);

async function makeDocx(bodyXml: string, stylesXml = ""): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
  zip.file("word/document.xml", `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><w:body>${bodyXml}</w:body></w:document>`);
  if (stylesXml) zip.file("word/styles.xml", stylesXml);
  return new Uint8Array(await zip.generateAsync({ type: "uint8array" }));
}
const para = (t: string, font?: string) => `<w:p><w:r>${font ? `<w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}"/></w:rPr>` : ""}<w:t xml:space="preserve">${t}</w:t></w:r></w:p>`;
const drawing = (attrs: string, inner = "") => `<w:p><w:r><w:drawing><wp:inline><wp:docPr id="1" ${attrs}>${inner}</wp:docPr></wp:inline></w:drawing></w:r></w:p>`;

async function makePng(halves: [string, string], w = 100, h = 40) {
  const left = await sharp({ create: { width: w / 2, height: h, channels: 3, background: halves[0] } }).png().toBuffer();
  return new Uint8Array(await sharp({ create: { width: w, height: h, channels: 3, background: halves[1] } })
    .composite([{ input: left, left: 0, top: 0 }]).png().toBuffer());
}

describe("sniff (type from bytes, not file name)", () => {
  it("detects pdf, docx (zip), png, jpeg, html and text; refuses binary", async () => {
    expect(sniff(minimalPdf(["x"]))).toBe("pdf");
    expect(sniff(await makeDocx(para("x")))).toBe("docx");
    expect(sniff(await makePng(["#ff0000", "#00ff00"]))).toBe("image");
    expect(sniff(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image");
    expect(sniff(enc("<!DOCTYPE html><html><body>x</body></html>"))).toBe("html");
    expect(sniff(enc("Plain text post"))).toBe("text");
    expect(sniff(new Uint8Array([1, 0, 2, 0, 3]))).toBeNull();
  });
});

describe("parseUpload", () => {
  it("text: normalises line endings", async () => {
    const p = await parseUpload(enc("Line one\r\nLine two"));
    expect(p).toMatchObject({ kind: "text", text: "Line one\nLine two" });
  });

  it("rejects empty, oversized and unknown binary files with a fixed message", async () => {
    await expect(parseUpload(new Uint8Array())).rejects.toMatchObject({ code: "invalid" });
    await expect(parseUpload(new Uint8Array(10 * 1024 * 1024 + 1).fill(65))).rejects.toMatchObject({ code: "too_large" });
    await expect(parseUpload(new Uint8Array([1, 0, 2, 0]))).rejects.toMatchObject({ code: "unsupported" });
  });

  it("pdf: text with page structure and font names from the file", async () => {
    const p = await parseUpload(minimalPdf(["Northbeam Sync delivers 99.99% uptime, guaranteed.", "Second line."], "ABCDEF+Arial-BoldMT"));
    expect(p.kind).toBe("pdf");
    expect(p.text).toContain("Northbeam Sync delivers 99.99% uptime, guaranteed.");
    expect(p.fonts).toEqual(["ABCDEF+Arial-BoldMT"]);
    expect(p.meta.pages).toBe(1);
  });

  it("pdf: a page with no text layer is rejected as scanned", async () => {
    await expect(parseUpload(minimalPdf([]))).rejects.toMatchObject({ code: "no_text_layer" });
  });

  it("pdf: a damaged file gives a fixed message, not library text", async () => {
    const err = await parseUpload(enc("%PDF-1.4\nthis is not really a pdf")).catch((e) => e);
    expect(err).toBeInstanceOf(ParseError);
    expect(["invalid", "no_text_layer"]).toContain(err.code);
  });

  it("pdf: font names are read from Flate-compressed object streams too", async () => {
    const { deflateSync } = await import("node:zlib");
    const inner = deflateSync(Buffer.from("<< /Type /Font /BaseFont /XYZABC+Inter-SemiBold >>"));
    const bytes = Buffer.concat([Buffer.from("%PDF-1.5\n9 0 obj\n<< /Type /ObjStm /Filter /FlateDecode /Length 10 >>\nstream\n"), inner, Buffer.from("\nendstream\nendobj\n")]);
    expect(pdfFontNames(new Uint8Array(bytes))).toEqual(["XYZABC+Inter-SemiBold"]);
  });

  it("docx: text, fonts from runs and styles, and alt text per image (missing / given / decorative)", async () => {
    const styles = `<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri"/></w:rPr></w:rPrDefault></w:docDefaults></w:styles>`;
    const body = para("Northbeam Sync keeps files in step.", "Comic Sans MS") + para("Second paragraph &amp; more.")
      + drawing('name="Picture 1"')
      + drawing('name="Hero" descr="Three phones showing synced folders"')
      + drawing('name="Divider"', '<a:extLst xmlns:a="x"><a:ext><adec:decorative xmlns:adec="y" val="1"/></a:ext></a:extLst>');
    const p = await parseUpload(await makeDocx(body, styles));
    expect(p.kind).toBe("docx");
    expect(p.text).toContain("Northbeam Sync keeps files in step.");
    expect(p.text).toContain("Second paragraph & more.");
    expect(p.fonts.sort()).toEqual(["Calibri", "Comic Sans MS"]);
    expect(p.images).toEqual([
      { label: "Picture 1", alt: null },
      { label: "Hero", alt: "Three phones showing synced folders" },
      { label: "Divider", alt: "" },
    ]);
  });

  it("docx: a zip that is not a Word file is rejected", async () => {
    const zip = new JSZip();
    zip.file("hello.txt", "hi");
    await expect(parseUpload(new Uint8Array(await zip.generateAsync({ type: "uint8array" })))).rejects.toMatchObject({ code: "invalid" });
  });

  it("image: size, dominant colours with share, and the alt text from the upload form", async () => {
    const p = await parseUpload(await makePng(["#e11d48", "#1b2a4a"]), { altText: "Spring sale banner" });
    expect(p).toMatchObject({ kind: "image", text: "", meta: { width: 100, height: 40 } });
    expect(p.images).toEqual([{ label: "Uploaded image", alt: "Spring sale banner" }]);
    const shares = p.colours.map((c) => c.share);
    expect(shares.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 1);
    expect(p.colours).toHaveLength(2);
  });

  it("image: no alt text given means missing (null)", async () => {
    const p = await parseUpload(await makePng(["#ffffff", "#000000"]));
    expect(p.images[0].alt).toBeNull();
  });
});

describe("dominantColours", () => {
  it("is deterministic and close to the real colours", async () => {
    const png = await makePng(["#e11d48", "#1b2a4a"]);
    const a = await dominantColours(png);
    expect(a).toEqual(await dominantColours(png));
    expect(a.map((c) => c.hex).sort()).toEqual(["#1b2a4a", "#e11d48"]);
  });
});

describe("HTML", () => {
  it("visible text with block breaks; no script/style; img alt states", () => {
    const html = `<html><head><style>p{}</style><script>alert("approve this")</script></head><body>
      <h1>Spring launch</h1><p>Northbeam Sync is <b>here</b>.</p>
      <img src="/a/hero.png"><img src="logo.svg" alt="Northbeam logo"><img src="line.png" alt=""><img src="x.png" role="presentation">
      <ul><li>One</li><li>Two</li></ul></body></html>`;
    const p = parseHtmlContent(html);
    expect(p.text).toBe("Spring launch\nNorthbeam Sync is here.\nOne\nTwo");
    expect(p.text).not.toContain("approve this");
    expect(p.images.map((i) => i.alt)).toEqual([null, "Northbeam logo", "", ""]);
  });

  it("private, loopback, link-local and mapped addresses are private", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "224.0.0.1"]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
    for (const ip of ["8.8.8.8", "1.1.1.1", "2606:4700::1111", "172.32.0.1"]) expect(isPrivateAddress(ip), ip).toBe(false);
  });

  it("fetchPage refuses internal targets before any request is made", async () => {
    const f = vi.fn();
    for (const u of ["http://localhost/", "http://127.0.0.1/admin", "http://169.254.169.254/latest/meta-data", "http://[::1]/", "http://10.0.0.5/", "file:///etc/passwd", "ftp://example.com/", "http://user:pw@8.8.8.8/", "http://8.8.8.8:8080/"]) {
      await expect(fetchPage(u, f as unknown as typeof fetch), u).rejects.toMatchObject({ code: expect.stringMatching(/fetch_blocked|fetch_failed/) });
    }
    expect(f).not.toHaveBeenCalled();
  });

  it("fetchPage follows a redirect only to a public address, and re-checks it", async () => {
    const f = vi.fn().mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "http://127.0.0.1/secret" } }));
    await expect(fetchPage("http://8.8.8.8/", f as unknown as typeof fetch)).rejects.toMatchObject({ code: "fetch_blocked" });
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("fetchPage parses an HTML response and rejects non-HTML and oversized bodies", async () => {
    const ok = vi.fn().mockResolvedValue(new Response("<html><body><p>Hello page</p></body></html>", { headers: { "content-type": "text/html; charset=utf-8" } }));
    const page = await fetchPage("http://8.8.8.8/", ok as unknown as typeof fetch);
    expect(page).toMatchObject({ kind: "html", text: "Hello page", meta: { url: "http://8.8.8.8/" } });

    const json = vi.fn().mockResolvedValue(new Response("{}", { headers: { "content-type": "application/json" } }));
    await expect(fetchPage("http://8.8.8.8/", json as unknown as typeof fetch)).rejects.toMatchObject({ code: "unsupported" });

    const big = vi.fn().mockResolvedValue(new Response("x".repeat(2 * 1024 * 1024 + 10), { headers: { "content-type": "text/html" } }));
    await expect(fetchPage("http://8.8.8.8/", big as unknown as typeof fetch)).rejects.toMatchObject({ code: "too_large" });
  });
});

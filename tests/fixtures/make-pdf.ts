/**
 * Builds a tiny one-page PDF with real text for parser tests (no binary fixtures in git).
 * `font` is the BaseFont name written into the file, e.g. "Helvetica" or "Arial-BoldMT".
 * Pass no lines to get a page with no text layer (like a scanned PDF).
 */
export function minimalPdf(lines: string[], font = "Helvetica"): Uint8Array {
  const esc = (s: string) => s.replace(/[()\\]/g, (c) => "\\" + c);
  const content = lines.map((l, i) => `BT /F1 12 Tf 72 ${720 - i * 16} Td (${esc(l)}) Tj ET`).join("\n");
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    `<< /Type /Font /Subtype /Type1 /BaseFont /${font} >>`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(pdf);
}

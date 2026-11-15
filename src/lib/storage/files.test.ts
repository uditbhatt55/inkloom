import { describe, expect, it } from "vitest";
import { contentFilePath, imageMime, logoPath, originalMime, safeFileName } from "./files";

describe("safeFileName", () => {
  it("drops folders, spaces and odd characters", () => {
    expect(safeFileName("C:\\Users\\me\\My Banner (final).png")).toBe("My-Banner-final-.png");
    expect(safeFileName("../../etc/passwd")).toBe("passwd");
    expect(safeFileName("..hidden")).toBe("hidden");
    expect(safeFileName("")).toBe("file");
    expect(safeFileName("???")).toBe("file");
  });
  it("keeps names short and keeps the extension", () => {
    const n = safeFileName(`${"a".repeat(200)}.pdf`);
    expect(n.length).toBeLessThanOrEqual(80);
    expect(n.endsWith(".pdf")).toBe(true);
  });
});

describe("paths", () => {
  it("start with the organisation id, which the storage policies read", () => {
    expect(contentFilePath("org", "ver", "a b.pdf")).toBe("org/ver/a-b.pdf");
    expect(logoPath("org", "asset", "logo.png")).toBe("org/asset/logo.png");
  });
});

describe("imageMime / originalMime", () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0]);
  const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const webp = new Uint8Array([...new TextEncoder().encode("RIFF"), 0, 0, 0, 0, ...new TextEncoder().encode("WEBP")]);
  it("reads the type from the bytes", () => {
    expect(imageMime(png)).toBe("image/png");
    expect(imageMime(jpg)).toBe("image/jpeg");
    expect(imageMime(webp)).toBe("image/webp");
    expect(imageMime(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'/>"))).toBeNull();
  });
  it("maps parsed kinds to a MIME type", () => {
    expect(originalMime("pdf", png)).toBe("application/pdf");
    expect(originalMime("image", png)).toBe("image/png");
    expect(originalMime("text", png)).toBe("text/plain");
  });
});

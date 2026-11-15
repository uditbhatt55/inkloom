import { describe, expect, it } from "vitest";
import { contentFilePath, imageMime, isStagedPathOf, logoPath, originalMime, safeFileName, stagedPath } from "./files";

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

describe("staged uploads", () => {
  const me = "00000000-0000-4000-8000-0000000000a1";
  const other = "00000000-0000-4000-8000-0000000000b1";
  const id = "11111111-2222-4333-8444-555555555555";
  it("accepts only a path in the user's own staging folder", () => {
    const p = stagedPath(me, id, "Brand Book 2023.pdf");
    expect(p).toBe(`staged/${me}/${id}/Brand-Book-2023.pdf`);
    expect(isStagedPathOf(me, p)).toBe(true);
    expect(isStagedPathOf(me.toUpperCase(), p)).toBe(true);
    expect(isStagedPathOf(other, p)).toBe(false);
  });
  it("refuses other buckets' layouts, traversal and odd names", () => {
    expect(isStagedPathOf(me, `00000000-0000-4000-8000-000000000001/${id}/banner.png`)).toBe(false);
    expect(isStagedPathOf(me, `staged/${me}/${id}/../x.pdf`)).toBe(false);
    expect(isStagedPathOf(me, `staged/${me}/${id}/a/b.pdf`)).toBe(false);
    expect(isStagedPathOf(me, `staged/${me}/not-a-uuid/b.pdf`)).toBe(false);
    expect(isStagedPathOf(me, `staged/${me}/${id}/b c.pdf`)).toBe(false);
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

import { readFileSync } from "node:fs";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { contrastRatio } from "@/lib/rules/contrast";
import { parseImage, textColourPair } from "./image";

/** White canvas with thin stripes (like text strokes) of one colour, plus an optional solid block of another. */
async function canvas(stripe: string, block?: string) {
  const rects = [
    ...Array.from({ length: 12 }, (_, i) => `<rect x="20" y="${30 + i * 20}" width="260" height="3" fill="${stripe}"/>`),
    block ? `<rect x="300" y="40" width="80" height="80" fill="${block}"/>` : "",
  ].join("");
  return new Uint8Array(await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#FFFFFF"/>${rects}</svg>`)).png().toBuffer());
}

describe("textColourPair", () => {
  it("finds a weak foreground colour on the main background, and flags thin strokes", async () => {
    const p = (await textColourPair(await canvas("#5EEAD4")))!;
    expect(contrastRatio(p.bg, "#FFFFFF")).toBeLessThan(1.1);
    expect(contrastRatio(p.fg, "#5EEAD4")).toBeLessThan(1.3);
    expect(contrastRatio(p.fg, p.bg)).toBeLessThan(3);
    expect(p.strokeLike).toBe(true);
  });

  it("picks the weakest foreground when a strong one is also present (navy block, pale stripes)", async () => {
    const p = (await textColourPair(await canvas("#5EEAD4", "#1B2A4A")))!;
    expect(contrastRatio(p.fg, "#5EEAD4")).toBeLessThan(1.3);
  });

  it("does not report anti-aliasing blends as a foreground colour", async () => {
    const p = (await textColourPair(await canvas("#000000")))!;
    expect(contrastRatio(p.fg, "#000000")).toBeLessThan(1.5); // the black stroke, not a grey blend
    expect(contrastRatio(p.fg, p.bg)).toBeGreaterThan(10);
  });

  it("returns null for a flat image", async () => {
    const flat = new Uint8Array(await sharp({ create: { width: 50, height: 50, channels: 3, background: "#FFFFFF" } }).png().toBuffer());
    expect(await textColourPair(flat)).toBeNull();
  });

  it("finds the pale teal headline of the low-contrast demo banner (the old guess missed it: under 5% of the image)", async () => {
    const p = (await textColourPair(new Uint8Array(readFileSync("seed/northbeam/img/banner-low-contrast.png"))))!;
    expect(contrastRatio(p.fg, p.bg)).toBeLessThan(3);
    expect(p.bg.toLowerCase()).toMatch(/^#f[0-9a-f]f[0-9a-f]f[0-9a-f]$/);
  });

  it("is deterministic and is attached to a parsed image", async () => {
    const bytes = await canvas("#5EEAD4");
    const parsed = await parseImage(bytes);
    expect(parsed.textPair).toEqual(await textColourPair(bytes));
  });
});

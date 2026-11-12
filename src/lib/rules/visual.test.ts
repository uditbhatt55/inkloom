import { describe, expect, it } from "vitest";
import { checkAltText, checkFonts, checkPalette, checkReadability, countSyllables, fontFamily, readingGrade } from "./visual";

const palette = [
  { name: "Northbeam Navy", hex: "#1B2A4A" },
  { name: "Signal Teal", hex: "#14B8A6" },
];

describe("palette distance (CIEDE2000)", () => {
  it("exact and near-exact brand colours pass", () => {
    expect(checkPalette([{ hex: "#1B2A4A", share: 0.5 }, { hex: "#15B9A7", share: 0.3 }], palette)).toEqual([]);
  });
  it("an off-palette dominant colour is a minor, medium-confidence visual finding citing the nearest colour", () => {
    const [f] = checkPalette([{ hex: "#E11D48", share: 0.4 }], palette);
    expect(f).toMatchObject({ category: "visual", severity: "minor", confidence: "medium", start: -1, ruleCode: "BRAND-PALETTE" });
    expect(f.explanation).toMatch(/ΔE \d+\.\d/);
  });
  it("ignores neutrals and small colour shares", () => {
    expect(checkPalette([{ hex: "#FFFFFF", share: 0.6 }, { hex: "#222222", share: 0.3 }, { hex: "#E11D48", share: 0.02 }], palette)).toEqual([]);
  });
  it("no palette means nothing to check", () => {
    expect(checkPalette([{ hex: "#E11D48", share: 0.4 }], [])).toEqual([]);
  });
});

describe("fonts", () => {
  it("normalises PDF subset prefixes, weights and styles", () => {
    expect(fontFamily("ABCDEF+Inter-SemiBold")).toBe("inter");
    expect(fontFamily("Arial,BoldItalic")).toBe("arial");
    expect(fontFamily("TimesNewRomanPSMT")).toBe("timesnewroman");
    expect(fontFamily("Helvetica Neue Light")).toBe("helvetica neue");
  });
  it("flags each unapproved family once, high confidence", () => {
    const out = checkFonts(["ABCDEF+Inter-Bold", "Inter-Regular", "ComicSansMS", "ComicSansMS-Bold"], [{ name: "Inter" }]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ category: "visual", confidence: "high", quote: "Font: ComicSansMS" });
  });
  it("never flags symbol / dingbat fonts used for bullets and icons", () => {
    const used = ["IEDNTF+SymbolMT", "AJIKXB+Wingdings-Regular", "Wingdings 2", "ZapfDingbats", "Segoe UI Symbol", "Webdings"];
    expect(checkFonts(used, [{ name: "Inter" }])).toEqual([]);
  });
});

describe("alt text (WCAG 1.1.1)", () => {
  it("missing is major, placeholder is minor, decorative and real descriptions pass", () => {
    const out = checkAltText([
      { label: "Image 1", alt: null },
      { label: "Image 2", alt: "IMG_2041.jpg" },
      { label: "Image 3", alt: "image" },
      { label: "Image 4", alt: "" },
      { label: "Image 5", alt: "Dashboard showing three synced devices" },
    ]);
    expect(out.map((f) => [f.quote.split(":")[0], f.severity])).toEqual([["Image 1", "major"], ["Image 2", "minor"], ["Image 3", "minor"]]);
  });
  it("whitespace-only alt counts as missing", () => {
    expect(checkAltText([{ label: "Hero", alt: "   " }])[0].severity).toBe("major");
  });
});

describe("readability", () => {
  it("syllable heuristic is sane", () => {
    expect(countSyllables("sync")).toBe(1);
    expect(countSyllables("platform")).toBe(2);
    expect(countSyllables("organisation")).toBeGreaterThanOrEqual(4);
  });
  it("short text is not measured", () => {
    expect(readingGrade("Short text.")).toBeNull();
  });
  it("plain text passes, dense text is flagged at medium confidence", () => {
    const plain = "Our app keeps your files in step. You can open them on any phone. It works when you are offline. We fix bugs fast. Ask us if you need help. We reply in a day.";
    const dense = "Organisational interoperability considerations notwithstanding, comprehensive implementation of synchronisation methodologies necessitates sophisticated infrastructural capabilities, continuous operational monitoring, and substantial institutional commitment from multidisciplinary stakeholders across geographically distributed administrative jurisdictions. Consequently, organisational transformation initiatives frequently encounter institutional resistance, necessitating comprehensive stakeholder communication.";
    expect(checkReadability(plain)).toEqual([]);
    const [f] = checkReadability(dense);
    expect(f).toMatchObject({ category: "accessibility", confidence: "medium", ruleCode: "READABILITY" });
  });
});

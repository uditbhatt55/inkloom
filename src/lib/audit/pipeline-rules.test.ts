import { describe, expect, it } from "vitest";
import type { Knowledge } from "@/lib/ai/brandpack";
import { runAudit } from "./pipeline";

const knowledge: Knowledge = {
  clauses: [], facts: [], terms: [],
  assets: [
    { type: "color", name: "Northbeam Navy", hex: "#1B2A4A", fontName: null },
    { type: "color", name: "Signal Teal", hex: "#14B8A6", fontName: null },
    { type: "font", name: "Inter", hex: null, fontName: "Inter" },
  ],
};
const base = { channel: "linkedin", audience: "public" as const, today: "2026-11-12", knowledge, ai: null };

describe("runAudit: rule pack, visual and accessibility checks (rule-only mode)", () => {
  it("adds rule-pack findings for hype and unsupported claims", async () => {
    const r = await runAudit({ ...base, content: "Our revolutionary platform is fully GDPR-compliant." });
    expect(r.findings.map((f) => f.ruleCode)).toEqual(expect.arrayContaining(["PACK-HYPE", "PACK-COMPLIANCE-CLAIM"]));
    expect(r.aiMode).toBe("skipped");
  });

  it("respects rule-pack codes the organisation disabled", async () => {
    const r = await runAudit({ ...base, knowledge: { ...knowledge, disabledPackRules: ["PACK-HYPE"] }, content: "A revolutionary update." });
    expect(r.findings.map((f) => f.ruleCode)).not.toContain("PACK-HYPE");
  });

  it("uses parser output: unapproved font, missing alt text, off-palette colour, extracted low contrast", async () => {
    const r = await runAudit({
      ...base, content: "",
      parsed: { fonts: ["ABCDEF+Inter-Bold", "ComicSansMS"], images: [{ label: "Hero", alt: null }], colours: [{ hex: "#e11d48", share: 0.55 }, { hex: "#f43f5e", share: 0.45 }] },
    });
    const codes = r.findings.map((f) => f.ruleCode);
    expect(codes).toEqual(expect.arrayContaining(["BRAND-FONTS", "WCAG-1.1.1", "BRAND-PALETTE", "WCAG-1.4.3"]));
    expect(r.findings.find((f) => f.ruleCode === "WCAG-1.4.3")!.confidence).toBe("medium");
  });

  it("colours typed on the form replace the extracted-contrast check (high confidence)", async () => {
    const r = await runAudit({
      ...base, content: "",
      parsed: { fonts: [], images: [], colours: [{ hex: "#e11d48", share: 0.55 }, { hex: "#f43f5e", share: 0.45 }] },
      colours: [{ fg: "#ffffff", bg: "#000000", label: "Headline", confidence: "high" }],
    });
    expect(r.findings.filter((f) => f.ruleCode === "WCAG-1.4.3")).toEqual([]);
  });
});

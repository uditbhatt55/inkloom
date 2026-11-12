import { describe, expect, it } from "vitest";
import { CATEGORIES, SEVERITIES } from "@/lib/audit/types";
import { checkRulePack, MARKETING_EN, type PackRule } from "./rulepack";

const codes = (text: string) => checkRulePack(text).map((f) => f.ruleCode);

describe("marketing-en rule pack (generated from vale-ai-tells + marketing-machine)", () => {
  it("every rule compiles, has a valid category/severity, a source and a unique code", () => {
    const seen = new Set<string>();
    for (const r of MARKETING_EN) {
      expect(() => new RegExp(r.pattern, "giu")).not.toThrow();
      expect(CATEGORIES).toContain(r.category);
      expect(SEVERITIES).toContain(r.severity);
      expect(r.source).toMatch(/\(MIT\)/);
      expect(seen.has(r.code)).toBe(false);
      seen.add(r.code);
    }
    expect(MARKETING_EN.length).toBeGreaterThanOrEqual(15);
  });

  it("flags hype, flawless and unmeasured claims in typical AI-drafted copy", () => {
    const text = "Northbeam Sync is a revolutionary, cutting-edge platform that works seamlessly and saves 10 hours a week, instantly.";
    const found = codes(text);
    expect(found).toContain("PACK-HYPE");
    expect(found).toContain("PACK-FLAWLESS");
    expect(found).toContain("PACK-UNMEASURED-GAIN");
    expect(found).toContain("PACK-UNMEASURED-SPEED");
  });

  it("flags compliance claims, vague sources and absolute assertions", () => {
    expect(codes("Our platform is fully GDPR-compliant.")).toContain("PACK-COMPLIANCE-CLAIM");
    expect(codes("Studies show that teams ship faster.")).toContain("PACK-VAGUE-SOURCE");
    expect(codes("This is the only way to stay on brand.")).toContain("PACK-ABSOLUTE");
  });

  it("offsets point at the matched text and every finding is medium confidence with no auto-fix", () => {
    const text = "We offer world-class support.";
    const [f] = checkRulePack(text).filter((x) => x.ruleCode === "PACK-HYPE");
    expect(text.slice(f.start, f.end)).toBe(f.quote);
    expect(f.quote.toLowerCase()).toBe("world-class");
    expect(f).toMatchObject({ confidence: "medium", source: "rule", suggestion: null, status: "open" });
  });

  it("is whole-word: no hits inside longer words", () => {
    expect(codes("Our robustness tests and the Seamlessness Award")).not.toContain("PACK-FLAWLESS");
  });

  it("plain, specific, sourced copy produces no findings (false-positive guard)", () => {
    const clean = [
      "Northbeam Sync keeps files in step across laptops and phones.",
      "The SLA covers 99.9% monthly uptime. Read the full terms on our website.",
      "Version 4.2 adds offline mode for Android. It is available to all paid plans from 1 December.",
      "Contact our support team by email; we reply within one working day.",
    ].join(" ");
    expect(checkRulePack(clean)).toEqual([]);
  });

  it("AI-vocabulary hits are information only (common human words like 'significant' must not cost points)", () => {
    const f = checkRulePack("This is a significant and crucial update.").filter((x) => x.ruleCode === "PACK-AI-VOCAB");
    expect(f.length).toBe(2);
    expect(f.every((x) => x.severity === "info")).toBe(true);
  });

  it("skips rules the organisation disabled", () => {
    expect(codes("A world-class team.")).toContain("PACK-HYPE");
    expect(checkRulePack("A world-class team.", MARKETING_EN, new Set(["PACK-HYPE"])).map((f) => f.ruleCode)).not.toContain("PACK-HYPE");
  });

  it("works with a custom pack and never loops on empty matches", () => {
    const pack: PackRule[] = [{ code: "X-1", category: "tone", severity: "minor", pattern: "x*", ignoreCase: false, message: "m", why: "w", fix: null, source: "test (MIT)" }];
    expect(checkRulePack("abc", pack)).toEqual([]);
  });
});

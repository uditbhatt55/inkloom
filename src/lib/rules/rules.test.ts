import { describe, expect, it } from "vitest";
import { checkContrast, contrastFinding, contrastRatio } from "./contrast";
import { checkExpiredFacts, isExpired } from "./facts";
import { checkTerms, type Term } from "./terms";

describe("contrast (WCAG 2.2 SC 1.4.3)", () => {
  it("black on white is 21:1", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
  });
  it("is symmetric and accepts hex without #", () => {
    expect(contrastRatio("#ffffff", "000000")).toBeCloseTo(21, 5);
  });
  it("#777777 on white (4.48) fails, #767676 (4.54) passes: boundary at 4.5", () => {
    expect(checkContrast("#777777", "#ffffff").passes).toBe(false);
    expect(checkContrast("#767676", "#ffffff").passes).toBe(true);
  });
  it("large text needs only 3:1", () => {
    expect(checkContrast("#777777", "#ffffff", true).passes).toBe(true);
    expect(checkContrast("#aaaaaa", "#ffffff", true).passes).toBe(false);
  });
  it("rejects invalid colours", () => {
    expect(() => contrastRatio("red", "#fff")).toThrow();
  });
  it("finding: none when passing; major/accessibility with ratio when failing", () => {
    expect(contrastFinding({ fg: "#000000", bg: "#ffffff", label: "Headline", confidence: "high" })).toBeNull();
    const f = contrastFinding({ fg: "#aaaaaa", bg: "#ffffff", label: "Headline", confidence: "medium" })!;
    expect(f).toMatchObject({ category: "accessibility", severity: "major", confidence: "medium", start: -1 });
    expect(f.explanation).toContain("2.32:1");
  });
});

describe("terminology", () => {
  const terms: Term[] = [
    { code: "TERM-01", term: "Northbeam Sync", kind: "preferred", replacement: null },
    { code: "TERM-02", term: "NB Sync", kind: "banned", replacement: "Northbeam Sync" },
    { code: "TERM-31", term: "Project Atlas", kind: "internal", replacement: null },
  ];
  it("flags a banned term with its replacement and exact offsets", () => {
    const text = "Try NB Sync today.";
    const [f] = checkTerms(text, terms);
    expect(f).toMatchObject({ ruleCode: "TERM-02", suggestion: "Northbeam Sync", category: "terminology", confidence: "high" });
    expect(text.slice(f.start, f.end)).toBe("NB Sync");
  });
  it("flags wrong casing of a preferred term but accepts the exact form", () => {
    expect(checkTerms("Northbeam Sync is fast.", terms)).toEqual([]);
    const [f] = checkTerms("northbeam sync is fast.", terms);
    expect(f).toMatchObject({ ruleCode: "TERM-01", suggestion: "Northbeam Sync" });
  });
  it("ignores internal terms (the Guard handles them)", () => {
    expect(checkTerms("Project Atlas", terms)).toEqual([]);
  });
});

describe("expired facts", () => {
  const fact = { code: "FACT-07", statement: "Northbeam Sync SLA: 99.9% monthly uptime", validUntil: "2026-11-10" };
  it("expiry boundary: yesterday expired, today and tomorrow valid, no date = valid", () => {
    expect(isExpired({ ...fact, validUntil: "2026-11-11" }, "2026-11-12")).toBe(true);
    expect(isExpired({ ...fact, validUntil: "2026-11-12" }, "2026-11-12")).toBe(false);
    expect(isExpired({ ...fact, validUntil: "2026-11-13" }, "2026-11-12")).toBe(false);
    expect(isExpired({ ...fact, validUntil: null }, "2026-11-12")).toBe(false);
  });
  it("flags content that restates the expired figure", () => {
    const text = "We promise 99.9% uptime.";
    const [f] = checkExpiredFacts(text, [fact], "2026-11-12");
    expect(f).toMatchObject({ ruleCode: "FACT-07", category: "factual", quote: "99.9%" });
    expect(text.slice(f.start, f.end)).toBe("99.9%");
  });
  it("rejects a malformed 'today' instead of silently comparing wrong", () => {
    expect(() => checkExpiredFacts("x", [fact], "12/11/2026")).toThrow(/YYYY-MM-DD/);
  });
  it("requires ALL figures of the fact; one of two is not enough", () => {
    const two = { code: "FACT-09", statement: "99.9% uptime across 3 regions", validUntil: "2026-01-01" };
    expect(checkExpiredFacts("99.9% uptime", [two], "2026-11-12")).toEqual([]);
    expect(checkExpiredFacts("99.9% uptime across 3 regions", [two], "2026-11-12")).toHaveLength(1);
  });
  it("does not flag 99.99% as 99.9%, nor a valid fact, nor a fact without figures", () => {
    expect(checkExpiredFacts("We promise 99.99% uptime.", [fact], "2026-11-12")).toEqual([]);
    expect(checkExpiredFacts("99.9% uptime", [{ ...fact, validUntil: "2027-03-31" }], "2026-11-12")).toEqual([]);
    expect(checkExpiredFacts("any text", [{ code: "F", statement: "No numbers", validUntil: "2020-01-01" }], "2026-11-12")).toEqual([]);
  });
});

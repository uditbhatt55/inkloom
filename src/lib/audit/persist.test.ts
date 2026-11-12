import { describe, expect, it } from "vitest";
import type { AuditResult } from "./pipeline";
import { toSavePayload } from "./persist";
import { rowsToKnowledge } from "./knowledge";
import { todayInIndia } from "./service";

const ids = { orgId: "o", versionId: "v", requestedBy: "u" };
const result = (o: Partial<AuditResult> = {}): AuditResult => ({
  findings: [{
    quote: "x".repeat(3000), start: -1, end: -1, category: "accessibility", severity: "major", confidence: "high", source: "rule",
    ruleCode: "WCAG-1.4.3", explanation: "e", suggestion: null, status: "open", label: null,
  }],
  score: { score: 90, byCategory: {}, blocked: false, openCritical: 0 } as AuditResult["score"],
  aiMode: "simulated", model: "simulated", promptVersion: "v1-draft", rejected: [], warnings: [], ...o,
});

describe("toSavePayload", () => {
  it("keeps real/simulated runs and their model", () => {
    expect(toSavePayload(result(), ids)).toMatchObject({ mode: "simulated", model: "simulated", ai_available: true, score: 90 });
  });
  it("stores skipped and failed AI as a rule-only run with no model", () => {
    for (const aiMode of ["skipped", "failed"] as const) {
      expect(toSavePayload(result({ aiMode, model: null }), ids)).toMatchObject({ mode: "rule_only", model: null, ai_available: false });
    }
  });
  it("passes rule codes, sources and -1 offsets through, and caps quote length", () => {
    const [f] = toSavePayload(result(), ids).findings;
    expect(f).toMatchObject({ rule_code: "WCAG-1.4.3", source: "rule", start_offset: -1, end_offset: -1 });
    expect(f.quote).toHaveLength(2000);
  });
});

describe("rowsToKnowledge", () => {
  it("maps snake_case rows and drops unknown asset types", () => {
    const k = rowsToKnowledge({
      clauses: [{ code: "C", category: "claim", text: "t", status: "active" }],
      facts: [{ code: "F", statement: "s", valid_from: null, valid_until: "2027-03-31", visibility: "internal" }],
      terms: [{ code: "T", term: "Project Atlas", kind: "internal", replacement: null }],
      assets: [{ type: "font", name: "Inter", hex: null, font_name: "Inter" }, { type: "video", name: "x", hex: null, font_name: null }],
    });
    expect(k.facts[0]).toEqual({ code: "F", statement: "s", validFrom: null, validUntil: "2027-03-31", visibility: "internal" });
    expect(k.assets).toEqual([{ type: "font", name: "Inter", hex: null, fontName: "Inter" }]);
  });
});

describe("todayInIndia", () => {
  it("uses Indian time: 20:00 UTC on 31 March is already 1 April in India", () => {
    expect(todayInIndia(new Date("2027-03-31T20:00:00Z"))).toBe("2027-04-01");
    expect(todayInIndia(new Date("2027-03-31T10:00:00Z"))).toBe("2027-03-31");
  });
});

import { describe, expect, it } from "vitest";
import type { Finding } from "@/lib/audit/types";
import { computeScore } from "./score";

const f = (o: Partial<Finding>): Finding => ({
  quote: "q", start: 0, end: 1, category: "claim", severity: "major", confidence: "high", source: "rule",
  ruleCode: null, explanation: "e", suggestion: null, status: "open", label: null, ...o,
});

describe("computeScore", () => {
  it("no findings = 100, not blocked", () => {
    expect(computeScore([])).toMatchObject({ score: 100, blocked: false, openCritical: 0 });
  });

  it("matches the proposal worked example: 100 - 25 - 10 - 10 - 1.8 = 53, blocked", () => {
    const r = computeScore([
      f({ category: "claim", severity: "critical" }),
      f({ category: "terminology", severity: "major" }),
      f({ category: "accessibility", severity: "major" }),
      f({ category: "tone", severity: "minor", confidence: "medium" }),
    ]);
    expect(r.score).toBe(53);
    expect(r.blocked).toBe(true);
    expect(r.byCategory.tone).toBeCloseTo(1.8);
  });

  it("caps one category at 40 points", () => {
    const five = Array.from({ length: 5 }, () => f({ category: "claim", severity: "critical" }));
    expect(computeScore(five).score).toBe(60);
  });

  it("low confidence never deducts and never blocks", () => {
    const r = computeScore([f({ severity: "critical", confidence: "low", label: "needs_human_check" })]);
    expect(r).toMatchObject({ score: 100, blocked: false });
  });

  it("dismissed, waived and resolved findings are excluded", () => {
    for (const status of ["dismissed", "waived", "resolved"] as const) {
      expect(computeScore([f({ severity: "critical", status })])).toMatchObject({ score: 100, blocked: false });
    }
  });

  it("D1: a creator-rejected finding still deducts and still blocks", () => {
    const r = computeScore([f({ severity: "critical", status: "rejected" })]);
    expect(r).toMatchObject({ score: 75, blocked: true });
  });

  it("score never goes below 0", () => {
    const many = (["claim", "tone", "visual", "factual", "messaging"] as const).flatMap((category) =>
      Array.from({ length: 3 }, () => f({ category, severity: "critical" })));
    expect(computeScore(many).score).toBe(0);
  });

  it("info findings cost nothing", () => {
    expect(computeScore([f({ severity: "info" })]).score).toBe(100);
  });
});

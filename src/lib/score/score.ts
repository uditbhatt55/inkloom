import type { Category, Confidence, Finding, FindingStatus, Severity } from "@/lib/audit/types";

// Proposal §7.5. Weights are a starting point per organisation; keep them in one place.
export const SEVERITY_WEIGHT: Record<Severity, number> = { critical: 25, major: 10, minor: 3, info: 0 };
export const CONFIDENCE_FACTOR: Record<Confidence, number> = { high: 1, medium: 0.6, low: 0 };
export const CATEGORY_CAP = 40;

/**
 * A finding stops counting only when a reviewer/owner dismisses or waives it, or it is resolved by a new version.
 * A creator REJECTING a fix does not clear it (decision D1). Mirrors the SQL approval gate.
 */
const CLEARED: FindingStatus[] = ["dismissed", "waived", "resolved"];
export const isUnresolved = (f: Pick<Finding, "status">) => !CLEARED.includes(f.status);

export type ScoreResult = {
  score: number;
  byCategory: Partial<Record<Category, number>>;
  /** approval is blocked while any Critical (non-low-confidence) finding is unresolved, whatever the score */
  blocked: boolean;
  openCritical: number;
};

export function computeScore(findings: Finding[]): ScoreResult {
  const byCategory: Partial<Record<Category, number>> = {};
  let openCritical = 0;
  for (const f of findings) {
    if (!isUnresolved(f)) continue;
    const d = SEVERITY_WEIGHT[f.severity] * CONFIDENCE_FACTOR[f.confidence];
    byCategory[f.category] = (byCategory[f.category] ?? 0) + d;
    if (f.severity === "critical" && f.confidence !== "low") openCritical++;
  }
  let total = 0;
  for (const c of Object.keys(byCategory) as Category[]) {
    byCategory[c] = Math.min(byCategory[c]!, CATEGORY_CAP);
    total += byCategory[c]!;
  }
  return { score: Math.max(0, Math.round(100 - total)), byCategory, blocked: openCritical > 0, openCritical };
}

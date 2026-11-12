export const CATEGORIES = ["tone", "terminology", "factual", "claim", "messaging", "visual", "accessibility", "confidentiality"] as const;
export const SEVERITIES = ["critical", "major", "minor", "info"] as const;
export const CONFIDENCES = ["high", "medium", "low"] as const;

export type Category = (typeof CATEGORIES)[number];
export type Severity = (typeof SEVERITIES)[number];
export type Confidence = (typeof CONFIDENCES)[number];
export type FindingStatus = "open" | "accepted" | "rejected" | "dismissed" | "waived" | "resolved";

export type Finding = {
  quote: string;
  /** character offsets into the original content; -1 when the finding is not about a text span (e.g. image colours) */
  start: number;
  end: number;
  category: Category;
  severity: Severity;
  confidence: Confidence;
  source: "rule" | "ai";
  /** code of the clause / fact / term this finding cites (e.g. CLAIM-02), or null */
  ruleCode: string | null;
  explanation: string;
  suggestion: string | null;
  status: FindingStatus;
  label: "needs_human_check" | "unverified_claim" | null;
};

import type { Database } from "@/lib/database.types";

type E = Database["public"]["Enums"];

export const STATUS_LABEL: Record<E["item_status"], string> = {
  draft: "Draft", ai_audited: "AI audited", in_review: "In review", changes_requested: "Changes requested", rejected: "Rejected", approved: "Approved",
};

export const SEVERITY_LABEL: Record<E["severity"], string> = { critical: "Critical", major: "Major", minor: "Minor", info: "Info" };
export const CONFIDENCE_LABEL: Record<E["confidence"], string> = { high: "High", medium: "Medium", low: "Low" };
export const CATEGORY_LABEL: Record<E["finding_category"], string> = {
  tone: "Tone", terminology: "Terminology", factual: "Fact", claim: "Claim", messaging: "Messaging",
  visual: "Visual", accessibility: "Accessibility", confidentiality: "Confidential",
};

/** How a run was produced, always shown next to the score (§7.6, §10.4). */
export const RUN_MODE_LABEL: Record<string, string> = {
  real: "AI review", simulated: "Simulated analysis", rule_only: "Rule checks only",
};

/** System rule codes that are not org clauses/facts/terms (decision D6). */
export function ruleSourceLabel(code: string | null): string | null {
  if (!code) return null;
  if (code === "WCAG-1.4.3") return "WCAG 2.2 · 1.4.3 Contrast (Minimum)";
  if (code === "WCAG-1.1.1") return "WCAG 2.2 · 1.1.1 Non-text Content";
  if (code === "READABILITY") return "Readability (Flesch–Kincaid grade)";
  if (code === "BRAND-PALETTE") return "Brand palette";
  if (code === "BRAND-FONTS") return "Brand fonts";
  if (code.startsWith("PACK-")) return `Wording rule ${code}`;
  return code;
}

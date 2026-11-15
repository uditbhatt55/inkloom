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

/** How each role is named in the UI (§8.1 roles; labels only). */
export const ROLE_LABEL: Record<E["member_role"], string> = {
  owner: "Brand owner", reviewer: "Reviewer", creator: "Creator", agency: "Agency", viewer: "Viewer",
};

/** Badge colours per item status (DESIGN.md §2). Soft background + dark text, all ≥4.5:1. */
export const STATUS_STYLE: Record<E["item_status"], string> = {
  draft: "bg-zinc-100 text-zinc-700",
  ai_audited: "bg-sky-100 text-sky-900",
  in_review: "bg-indigo-100 text-indigo-800",
  changes_requested: "bg-amber-100 text-amber-900",
  rejected: "bg-red-100 text-red-800",
  approved: "bg-green-100 text-green-800",
};

/** Solid severity badge colours (DESIGN.md §2), white text ≥4.5:1. */
export const SEVERITY_STYLE: Record<E["severity"], string> = {
  critical: "bg-critical text-white",
  major: "bg-major text-white",
  minor: "bg-minor text-white",
  info: "bg-info text-white",
};

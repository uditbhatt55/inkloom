import type { Finding } from "@/lib/audit/types";
import { findTerm } from "@/lib/text/match";

export type Term = { code: string; term: string; kind: "preferred" | "banned" | "internal"; replacement: string | null };

const base = { source: "rule", confidence: "high", status: "open", label: null } as const;

/**
 * banned    -> every whole-word occurrence is a finding (suggest the replacement if there is one)
 * preferred -> occurrences whose spelling/casing differs from the preferred form are findings ("northbeam sync")
 * internal  -> handled by the Confidential Guard, ignored here
 */
export function checkTerms(text: string, terms: Term[]): Finding[] {
  const out: Finding[] = [];
  for (const t of terms) {
    for (const m of findTerm(text, t.term)) {
      if (t.kind === "banned") {
        out.push({
          ...base, quote: m.quote, start: m.start, end: m.end, category: "terminology", severity: "major", ruleCode: t.code,
          explanation: `"${m.quote}" is a banned term.`,
          suggestion: t.replacement,
        });
      } else if (t.kind === "preferred" && m.quote !== t.term.trim()) {
        out.push({
          ...base, quote: m.quote, start: m.start, end: m.end, category: "terminology", severity: "major", ruleCode: t.code,
          explanation: `Use the approved form "${t.term}".`,
          suggestion: t.term,
        });
      }
    }
  }
  return out;
}

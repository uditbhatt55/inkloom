import type { AuditResult } from "@/lib/audit/pipeline";

/** The JSON body of public.save_audit() (migration 20261112000300). */
export type SaveAuditPayload = {
  org_id: string; version_id: string; requested_by: string;
  mode: "real" | "simulated" | "rule_only"; model: string | null; prompt_ver: string;
  score: number; ai_available: boolean; warnings: string[];
  findings: {
    category: string; severity: string; confidence: string; quote: string; start_offset: number; end_offset: number;
    rule_code: string | null; source: "rule" | "ai"; label: string | null; explanation: string; suggestion: string | null;
  }[];
};

/**
 * AuditResult → save_audit() payload. Pure. AI "skipped" or "failed" is stored as a rule-only run, never as real or
 * simulated, so the history shows exactly what produced each score (§7.6, §8.2).
 */
export function toSavePayload(r: AuditResult, ids: { orgId: string; versionId: string; requestedBy: string }): SaveAuditPayload {
  const aiRan = r.aiMode === "real" || r.aiMode === "simulated";
  return {
    org_id: ids.orgId, version_id: ids.versionId, requested_by: ids.requestedBy,
    mode: aiRan ? (r.aiMode as "real" | "simulated") : "rule_only",
    model: aiRan ? r.model : null, prompt_ver: r.promptVersion,
    score: r.score.score, ai_available: aiRan, warnings: r.warnings,
    findings: r.findings.map((f) => ({
      category: f.category, severity: f.severity, confidence: f.confidence, quote: f.quote.slice(0, 2000),
      start_offset: f.start, end_offset: f.end, rule_code: f.ruleCode, source: f.source, label: f.label,
      explanation: f.explanation, suggestion: f.suggestion,
    })),
  };
}

import type { Knowledge } from "@/lib/ai/brandpack";
import type { AiReviewer } from "@/lib/ai/reviewer";
import { runAudit, type AuditInput, type AuditResult, type ContrastCheck } from "@/lib/audit/pipeline";
import { toSavePayload, type SaveAuditPayload } from "@/lib/audit/persist";
import type { ParsedContent } from "@/lib/parsers/types";

/** What the service needs from the database. The real one is SupabaseAuditStore; tests pass a fake. */
export interface AuditStore {
  /** ALL knowledge of the org, including internal facts/terms (needed by the Confidential Guard; never sent to the model). */
  loadKnowledge(orgId: string): Promise<Knowledge>;
  saveAudit(payload: SaveAuditPayload): Promise<string>;
}

export type AuditVersionInput = {
  orgId: string; versionId: string; requestedBy: string;
  parsed: ParsedContent; channel: string; audience: "public" | "internal";
  colours?: ContrastCheck[]; today: string;
};

export type AuditVersionResult = { runId: string; result: AuditResult };

/** Steps 2–7 of §7 for one stored version: load knowledge, run the pipeline, save run + findings atomically. */
export async function auditVersion(store: AuditStore, ai: AiReviewer | null, i: AuditVersionInput): Promise<AuditVersionResult> {
  const knowledge = await store.loadKnowledge(i.orgId);
  const input: AuditInput = {
    content: i.parsed.text, channel: i.channel, audience: i.audience, today: i.today, knowledge, ai,
    colours: i.colours, parsed: { fonts: i.parsed.fonts, images: i.parsed.images, colours: i.parsed.colours },
  };
  const result = await runAudit(input);
  result.warnings.push(...i.parsed.warnings);
  const runId = await store.saveAudit(toSavePayload(result, { orgId: i.orgId, versionId: i.versionId, requestedBy: i.requestedBy }));
  return { runId, result };
}

/** YYYY-MM-DD in India time, so a fact "valid until 31 Mar" expires at Indian midnight, not UTC. */
export const todayInIndia = (now = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(now);

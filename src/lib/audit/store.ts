import type { Knowledge } from "@/lib/ai/brandpack";
import { rowsToKnowledge } from "@/lib/audit/knowledge";
import type { SaveAuditPayload } from "@/lib/audit/persist";
import type { AuditStore } from "@/lib/audit/service";
import type { Db } from "@/lib/supabase/server";

/** AuditStore over Supabase. Must be given the SERVICE client (internal knowledge + save_audit are server-only). */
export class SupabaseAuditStore implements AuditStore {
  constructor(private db: Db) {}

  async loadKnowledge(orgId: string): Promise<Knowledge> {
    const [clauses, facts, terms, assets] = await Promise.all([
      this.db.from("guideline_clauses").select("code, category, text, status").eq("org_id", orgId),
      this.db.from("approved_facts").select("code, statement, valid_from, valid_until, visibility").eq("org_id", orgId),
      this.db.from("terminology").select("code, term, kind, replacement").eq("org_id", orgId),
      this.db.from("brand_assets").select("type, name, hex, font_name").eq("org_id", orgId),
    ]);
    const err = clauses.error ?? facts.error ?? terms.error ?? assets.error;
    if (err) throw new Error(`knowledge load failed: ${err.code}`);
    return rowsToKnowledge({ clauses: clauses.data!, facts: facts.data!, terms: terms.data!, assets: assets.data! });
  }

  async saveAudit(payload: SaveAuditPayload): Promise<string> {
    const { data, error } = await this.db.rpc("save_audit", { p: payload });
    if (error || typeof data !== "string") throw new Error(`save_audit failed: ${error?.code ?? "no id"}`);
    return data;
  }
}

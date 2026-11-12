import { readFileSync } from "node:fs";
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import type { Knowledge } from "@/lib/ai/brandpack";
import { chooseReviewer } from "@/lib/ai/select";
import { rowsToKnowledge, type KnowledgeRows } from "@/lib/audit/knowledge";
import type { SaveAuditPayload } from "@/lib/audit/persist";
import { auditVersion, type AuditStore } from "@/lib/audit/service";
import { parseUpload } from "@/lib/parsers";
import recording from "@/lib/ai/recordings/northbeam-post.json";
import { createDb } from "../db/harness";

/**
 * The audit service end to end on a real Postgres (PGlite) with the Northbeam seed: same queries as SupabaseAuditStore,
 * run as the service role. Covers what /api/audit does after the version is stored.
 */
const ORG = "00000000-0000-4000-8000-000000000001";
const USER = "00000000-0000-4000-8000-0000000000c1";
let db: PGlite;

class PgliteStore implements AuditStore {
  async loadKnowledge(orgId: string): Promise<Knowledge> {
    const q = async <T,>(sql: string) => (await db.query<T>(sql, [orgId])).rows;
    const rows: KnowledgeRows = {
      clauses: await q("select code, category, text, status from guideline_clauses where org_id = $1"),
      facts: await q("select code, statement, valid_from::text, valid_until::text, visibility from approved_facts where org_id = $1"),
      terms: await q("select code, term, kind, replacement from terminology where org_id = $1"),
      assets: await q("select type, name, hex, font_name from brand_assets where org_id = $1"),
    };
    return rowsToKnowledge(rows);
  }
  async saveAudit(p: SaveAuditPayload): Promise<string> {
    return db.transaction(async (tx) => {
      await tx.exec("set local role service_role");
      return (await tx.query<{ id: string }>("select public.save_audit($1::jsonb) as id", [JSON.stringify(p)])).rows[0].id;
    });
  }
}

let n = 0;
async function newVersion(text: string): Promise<string> {
  n++;
  const item = `00000000-0000-4000-8000-0000000001${String(n).padStart(2, "0")}`;
  const version = `00000000-0000-4000-8000-0000000002${String(n).padStart(2, "0")}`;
  await db.query("insert into content_items (id, org_id, title, owner_id) values ($1, $2, 'post', $3)", [item, ORG, USER]);
  await db.query("insert into content_versions (id, org_id, item_id, n, text, sha256, created_by) values ($1, $2, $3, 1, $4, 'h', $5)", [version, ORG, item, text, USER]);
  return version;
}

const run = async (text: string) => {
  const versionId = await newVersion(text);
  const parsed = await parseUpload(new TextEncoder().encode(text));
  const out = await auditVersion(new PgliteStore(), chooseReviewer({}), {
    orgId: ORG, versionId, requestedBy: USER, parsed, channel: "linkedin", audience: "public", today: "2026-11-12",
  });
  return { ...out, versionId };
};

beforeAll(async () => {
  db = await createDb();
  await db.exec(readFileSync("supabase/seed.sql", "utf8"));
  await db.query("insert into auth.users (id, email) values ($1, 'creator@northbeam.test')", [USER]);
  await db.query("insert into memberships values ($1, $2, 'creator')", [ORG, USER]);
}, 120_000);

describe("auditVersion on the Northbeam seed", () => {
  it("demo recording: AI + rule findings saved, cited codes resolved, claim link stored, approval blocked", async () => {
    const { runId, result, versionId } = await run(recording.content);
    expect(result.aiMode).toBe("simulated");
    expect(result.score.blocked).toBe(true);

    const saved = (await db.query<{ rule_code: string; source: string; has_ref: boolean }>(
      "select rule_code, source, (clause_id is not null or fact_id is not null or term_id is not null) as has_ref from findings where run_id = $1", [runId])).rows;
    expect(saved).toHaveLength(result.findings.length);
    expect(saved).toContainEqual({ rule_code: "FACT-07", source: "ai", has_ref: true });
    expect(saved).toContainEqual({ rule_code: "TERM-02", source: "rule", has_ref: true });

    const runRow = (await db.query<{ mode: string; score: number }>("select mode, score from audit_runs where id = $1", [runId])).rows[0];
    expect(runRow).toEqual({ mode: "simulated", score: result.score.score });
    const links = (await db.query("select 1 from claim_links where version_id = $1", [versionId])).rows;
    expect(links.length).toBeGreaterThan(0);
  });

  it("new content without a recording: rule-only run, warning kept, pack and guard findings", async () => {
    const { runId, result } = await run("Our revolutionary NB Sync will ship Project Atlas next month. Studies show that it is the only way to work.");
    expect(result.aiMode).toBe("skipped");
    const codes = result.findings.map((f) => f.ruleCode);
    expect(codes).toEqual(expect.arrayContaining(["TERM-31", "TERM-02", "PACK-HYPE", "PACK-VAGUE-SOURCE", "PACK-ABSOLUTE"]));
    expect(result.findings.find((f) => f.ruleCode === "TERM-31")).toMatchObject({ category: "confidentiality", severity: "critical" });
    expect(result.score.blocked).toBe(true);
    const runRow = (await db.query<{ mode: string; warnings: string[] }>("select mode, warnings from audit_runs where id = $1", [runId])).rows[0];
    expect(runRow.mode).toBe("rule_only");
    expect(runRow.warnings).toContain("AI judgement checks were skipped.");
  });

  it("an expired fact restated in copy is flagged (FACT-05 ended 30 June 2026)", async () => {
    const { result } = await run("Northbeam Vault starts at INR 499 per month.");
    expect(result.findings.map((f) => f.ruleCode)).toContain("FACT-05");
  });

  it("clean, approved wording passes with a high score and no block", async () => {
    const { result } = await run("Northbeam Sync keeps your files in step across devices. Our SLA covers 99.9% monthly uptime.");
    expect(result.score.blocked).toBe(false);
    expect(result.score.score).toBeGreaterThanOrEqual(90);
  });
});

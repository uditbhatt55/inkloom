import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { asUser, createDb } from "../db/harness";

/** Knowledge Centre (P2): owner-only writes, clause versioning (migration 20261114000000). */
const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
const OWNER = "00000000-0000-4000-8000-0000000000f1";
const CREATOR = "00000000-0000-4000-8000-0000000000f2";
const B_OWNER = "00000000-0000-4000-8000-0000000000f3";
const CLAUSE = "00000000-0000-4000-8000-0000000000a1";
let db: PGlite;

beforeAll(async () => {
  db = await createDb();
  await db.exec(`
    insert into auth.users (id, email) values ('${OWNER}','owner@a.test'),('${CREATOR}','cre@a.test'),('${B_OWNER}','own@b.test');
    insert into organizations (id, name) values ('${A}','Org A'),('${B}','Org B');
    insert into memberships values ('${A}','${OWNER}','owner'),('${A}','${CREATOR}','creator'),('${B}','${B_OWNER}','owner');
    insert into guideline_clauses (id, org_id, code, category, text) values ('${CLAUSE}','${A}','CLAIM-02','claim','Do not say guaranteed.');
  `);
}, 120_000);

const n = async (tx: Pick<PGlite, "query">, sql: string, params: unknown[] = []) => (await tx.query<{ n: number }>(sql, params)).rows[0].n;

describe("clause versioning", () => {
  it("changing the text bumps the version and keeps the old text in history", async () => {
    await asUser(db, OWNER, async (tx) => {
      await tx.query("update guideline_clauses set text = 'Do not describe service levels as guaranteed; refer to the SLA.' where id = $1", [CLAUSE]);
      const row = (await tx.query<{ version: number; text: string }>("select version, text from guideline_clauses where id = $1", [CLAUSE])).rows[0];
      expect(row.version).toBe(2);
      const hist = (await tx.query<{ version: number; text: string; changed_by: string }>("select version, text, changed_by from guideline_clause_history where clause_id = $1", [CLAUSE])).rows;
      expect(hist).toEqual([{ version: 1, text: "Do not say guaranteed.", changed_by: OWNER }]);
    });
  });

  it("changing only the status keeps the version and writes no history", async () => {
    await asUser(db, OWNER, async (tx) => {
      await tx.query("update guideline_clauses set status = 'retired' where id = $1", [CLAUSE]);
      expect(await n(tx, "select version as n from guideline_clauses where id = $1", [CLAUSE])).toBe(1);
      expect(await n(tx, "select count(*)::int as n from guideline_clause_history")).toBe(0);
    });
  });

  it("ignores a version, code or category sent by the client", async () => {
    await asUser(db, OWNER, async (tx) => {
      await tx.query("update guideline_clauses set version = 99, code = 'HACK-01', category = 'tone' where id = $1", [CLAUSE]);
      const row = (await tx.query<{ version: number; code: string; category: string }>("select version, code, category from guideline_clauses where id = $1", [CLAUSE])).rows[0];
      expect(row).toEqual({ version: 1, code: "CLAIM-02", category: "claim" });
    });
  });
});

describe("owner-only writes (§8.1)", () => {
  it("a creator cannot add or change clauses, facts, terms or assets", async () => {
    // one transaction per statement: a refused insert aborts its transaction
    for (const sql of [
      "insert into guideline_clauses (org_id, code, category, text) values ($1,'X-01','claim','x')",
      "insert into approved_facts (org_id, code, statement) values ($1,'F-1','x')",
      "insert into terminology (org_id, code, term, kind) values ($1,'T-1','x','banned')",
      "insert into brand_assets (org_id, type, name, hex) values ($1,'color','x','#000000')",
    ]) {
      await asUser(db, CREATOR, async (tx) => {
        await expect(tx.query(sql, [A]), sql).rejects.toThrow(/row-level security/);
      });
    }
    await asUser(db, CREATOR, async (tx) => {
      const updated = await tx.query("update guideline_clauses set text = 'hijacked' where id = $1 returning id", [CLAUSE]);
      expect(updated.rows).toHaveLength(0);
    });
  });

  it("nobody can write clause history directly", async () => {
    await asUser(db, OWNER, async (tx) => {
      await expect(tx.query("insert into guideline_clause_history (org_id, clause_id, version, text) values ($1,$2,1,'fake')", [A, CLAUSE])).rejects.toThrow(/permission denied/);
    });
  });

  it("members read history; another organisation does not", async () => {
    await db.transaction(async (tx) => {
      await tx.exec(`set local role authenticated; select set_config('request.jwt.claims', '{"sub":"${OWNER}"}', true);`);
      await tx.query("update guideline_clauses set text = 'New wording' where id = $1", [CLAUSE]);
      await tx.exec(`select set_config('request.jwt.claims', '{"sub":"${CREATOR}"}', true);`);
      expect(await n(tx, "select count(*)::int as n from guideline_clause_history")).toBe(1);
      await tx.exec(`select set_config('request.jwt.claims', '{"sub":"${B_OWNER}"}', true);`);
      expect(await n(tx, "select count(*)::int as n from guideline_clause_history")).toBe(0);
      await tx.rollback();
    });
  });
});

describe("deleting facts (Facts tab)", () => {
  const FACT = "00000000-0000-4000-8000-0000000000b1";
  const CITED = "00000000-0000-4000-8000-0000000000b2";

  async function withFacts(fn: (tx: Pick<PGlite, "query" | "exec">) => Promise<void>) {
    await db.transaction(async (tx) => {
      await tx.exec(`
        insert into approved_facts (id, org_id, code, statement) values ('${FACT}','${A}','FACT-50','Unused fact'),('${CITED}','${A}','FACT-51','Cited fact');
        insert into content_items (id, org_id, title, owner_id) values ('00000000-0000-4000-8000-0000000000c9','${A}','post','${CREATOR}');
        insert into content_versions (id, org_id, item_id, n, text, sha256, created_by) values ('00000000-0000-4000-8000-0000000000d9','${A}','00000000-0000-4000-8000-0000000000c9',1,'x','h','${CREATOR}');
        insert into audit_runs (id, org_id, version_id, mode) values ('00000000-0000-4000-8000-0000000000e9','${A}','00000000-0000-4000-8000-0000000000d9','rule_only');
        insert into findings (org_id, run_id, category, severity, confidence, quote, explanation, fact_id)
          values ('${A}','00000000-0000-4000-8000-0000000000e9','factual','major','high','x','cites FACT-51','${CITED}');
      `);
      try {
        await fn(tx);
      } finally {
        await tx.rollback();
      }
    });
  }
  const as = (tx: Pick<PGlite, "exec">, user: string) => tx.exec(`reset role; set local role authenticated; select set_config('request.jwt.claims', '{"sub":"${user}"}', true);`);

  it("the owner can delete a fact no finding cites", async () => {
    await withFacts(async (tx) => {
      await as(tx, OWNER);
      expect((await tx.query("delete from approved_facts where id = $1 returning id", [FACT])).rows).toHaveLength(1);
    });
  });

  it("a fact cited by a finding cannot be deleted (23503), so past findings keep their source", async () => {
    await withFacts(async (tx) => {
      await as(tx, OWNER);
      await expect(tx.query("delete from approved_facts where id = $1", [CITED])).rejects.toMatchObject({ code: "23503" });
    });
  });

  it("a creator cannot delete facts", async () => {
    await withFacts(async (tx) => {
      await as(tx, CREATOR);
      expect((await tx.query("delete from approved_facts where id = $1 returning id", [FACT])).rows).toHaveLength(0);
    });
  });
});

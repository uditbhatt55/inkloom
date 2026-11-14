import { readFileSync } from "node:fs";
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { asUser, createDb } from "../db/harness";

let db: PGlite;
const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
const CREATOR = "00000000-0000-4000-8000-0000000000c1";
const REVIEWER = "00000000-0000-4000-8000-0000000000c2";
const B_OWNER = "00000000-0000-4000-8000-0000000000c3";
const ITEM = "00000000-0000-4000-8000-0000000000d1";
const VERSION = "00000000-0000-4000-8000-0000000000e1";

beforeAll(async () => {
  db = await createDb();
  await db.exec(`
    insert into auth.users (id, email) values ('${CREATOR}','cre@a.test'),('${REVIEWER}','rev@a.test'),('${B_OWNER}','own@b.test');
    insert into organizations (id, name) values ('${A}','Org A'),('${B}','Org B');
    insert into memberships values ('${A}','${CREATOR}','creator'),('${A}','${REVIEWER}','reviewer'),('${B}','${B_OWNER}','owner');
    insert into guideline_clauses (org_id, code, category, text) values ('${A}','CLAIM-02','claim','No "guaranteed".'),('${B}','CLAIM-02','claim','Org B clause');
    insert into approved_facts (org_id, code, statement) values ('${A}','FACT-07','Sync SLA: 99.9% monthly uptime');
    insert into terminology (org_id, code, term, kind, replacement) values ('${A}','TERM-02','NB Sync','banned','Northbeam Sync');
    insert into content_items (id, org_id, title, owner_id) values ('${ITEM}','${A}','Launch post','${CREATOR}');
    insert into content_versions (id, org_id, item_id, n, text, sha256, created_by)
      values ('${VERSION}','${A}','${ITEM}',1,'Northbeam Sync delivers 99.99% uptime, guaranteed. NB Sync rocks.','h','${CREATOR}');
  `);
}, 120_000);

const finding = (o: Record<string, unknown>) => ({
  category: "claim", severity: "major", confidence: "high", quote: "q", start_offset: 0, end_offset: 1,
  rule_code: null, source: "rule", label: null, explanation: "e", suggestion: null, ...o,
});
const payload = (o: Record<string, unknown> = {}) => ({
  org_id: A, version_id: VERSION, requested_by: CREATOR, mode: "simulated", model: "simulated", prompt_ver: "v1-draft",
  score: 53, ai_available: true, warnings: ["AI judgement checks were skipped."],
  findings: [
    finding({ quote: "99.99% uptime, guaranteed", severity: "critical", rule_code: "FACT-07", source: "ai", suggestion: "99.9% monthly uptime" }),
    finding({ quote: "guaranteed", rule_code: "CLAIM-02", source: "ai" }),
    finding({ category: "terminology", quote: "NB Sync", rule_code: "TERM-02" }),
    finding({ category: "accessibility", quote: "Banner: #aaaaaa on #ffffff", start_offset: -1, end_offset: -1, rule_code: "WCAG-1.4.3" }),
    finding({ category: "tone", severity: "minor", confidence: "medium", quote: "rocks", rule_code: "PACK-HYPE" }),
    finding({ category: "claim", quote: "trusted by 500 companies", confidence: "low", label: "unverified_claim", source: "ai" }),
  ],
  ...o,
});

/** save_audit runs as the server's service role; every call is rolled back so tests stay independent. */
async function asService<T>(fn: (tx: Pick<PGlite, "query" | "exec">) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.exec("set local role service_role");
    try {
      return await fn(tx);
    } finally {
      await tx.rollback();
    }
  }) as Promise<T>;
}
const save = (tx: Pick<PGlite, "query">, p: unknown) => tx.query<{ id: string }>("select public.save_audit($1::jsonb) as id", [JSON.stringify(p)]);

describe("existing SQL test suites (were run by hand in the Supabase SQL editor)", () => {
  it.each([["supabase/tests/rls_test.sql", /ALL 19 RLS TESTS PASSED/], ["supabase/tests/rls_gate_test.sql", /ALL 7 GATE TESTS PASSED/]])("%s", async (file, pass) => {
    await expect(db.exec(readFileSync(file, "utf8"))).rejects.toThrow(pass);
  });
});

describe("content_items read policy (migrations 20261113000000 + 000100)", () => {
  it("a creator can create an item and get it back (INSERT … RETURNING), which the old policy refused", async () => {
    await asUser(db, CREATOR, async (tx) => {
      const r = await tx.query("insert into content_items (org_id, title, owner_id) values ($1, 'New post', $2) returning id", [A, CREATOR]);
      expect(r.rows).toHaveLength(1);
    });
  });

  it("another organisation's owner sees none of org A's items", async () => {
    await asUser(db, B_OWNER, async (tx) => {
      expect((await tx.query<{ n: number }>("select count(*)::int as n from content_items where org_id = $1", [A])).rows[0].n).toBe(0);
    });
  });

  it("anon gets no rows and no error", async () => {
    await db.transaction(async (tx) => {
      await tx.exec("set local role anon");
      expect((await tx.query<{ n: number }>("select count(*)::int as n from content_items")).rows[0].n).toBe(0);
      await tx.rollback();
    });
  });
});

describe("approved_facts.updated_at (migration 20261114100000)", () => {
  it("moves when the statement, dates or visibility change, not for an owner or evidence edit", async () => {
    await db.transaction(async (tx) => {
      const at = async () => (await tx.query<{ t: string }>("select updated_at::text as t from approved_facts where code = 'FACT-07'")).rows[0].t;
      const before = await at(); // set when beforeAll inserted the fact, in an earlier transaction
      await tx.exec("update approved_facts set owner_name = 'Legal', evidence_ref = 'SLA v3' where code = 'FACT-07'");
      expect(await at()).toBe(before);
      await tx.exec("update approved_facts set statement = 'Sync SLA: 99.95% monthly uptime' where code = 'FACT-07'");
      expect(await at()).not.toBe(before);
      await tx.rollback();
    });
  });
});

describe("save_audit()", () => {
  it("writes the run, resolves codes to THIS org's clause/fact/term, keeps system codes, and maps -1 offsets to null", async () => {
    await asService(async (tx) => {
      const { rows: [{ id }] } = await save(tx, payload());
      const run = (await tx.query<{ mode: string; score: number; warnings: string[]; requested_by: string }>("select mode, score, warnings, requested_by from audit_runs where id = $1", [id])).rows[0];
      expect(run).toMatchObject({ mode: "simulated", score: 53, warnings: ["AI judgement checks were skipped."], requested_by: CREATOR });

      const rows = (await tx.query<Record<string, unknown>>(`
        select f.rule_code, f.source, f.label, f.start_offset, c.org_id as clause_org, (f.clause_id is not null) as has_clause,
               (f.fact_id is not null) as has_fact, (f.term_id is not null) as has_term
        from findings f left join guideline_clauses c on c.id = f.clause_id where f.run_id = $1 order by f.rule_code nulls last`, [id])).rows;
      const by = Object.fromEntries(rows.map((r) => [r.rule_code ?? "none", r]));
      expect(by["CLAIM-02"]).toMatchObject({ has_clause: true, clause_org: A, source: "ai" });
      expect(by["FACT-07"]).toMatchObject({ has_fact: true });
      expect(by["TERM-02"]).toMatchObject({ has_term: true, source: "rule" });
      expect(by["WCAG-1.4.3"]).toMatchObject({ has_clause: false, has_fact: false, has_term: false, start_offset: null });
      expect(by["PACK-HYPE"]).toMatchObject({ has_clause: false });
      expect(by.none).toMatchObject({ label: "unverified_claim" });
      expect(rows).toHaveLength(6);
    });
  });

  it("records a claim link for findings that cite an approved fact (fact-impact alerts)", async () => {
    await asService(async (tx) => {
      await save(tx, payload());
      const links = (await tx.query<{ quote: string }>("select quote from claim_links where version_id = $1", [VERSION])).rows;
      expect(links).toEqual([{ quote: "99.99% uptime, guaranteed" }]);
    });
  });

  it("links facts the content restates correctly (fact_links), ignores unknown codes, one link per fact, no duplicates on re-audit", async () => {
    await asService(async (tx) => {
      const links = [{ fact_code: "FACT-07", quote: "99.9%" }, { fact_code: "FACT-404", quote: "x" }];
      await save(tx, payload({ findings: [], fact_links: links }));
      await save(tx, payload({ findings: [], fact_links: links }));
      expect((await tx.query("select quote from claim_links where version_id = $1", [VERSION])).rows).toEqual([{ quote: "99.9%" }]);
    });
    await asService(async (tx) => {
      // a finding that cites the fact and a restatement of it give ONE link, the finding's quote
      await save(tx, payload({ fact_links: [{ fact_code: "FACT-07", quote: "99.9%" }] }));
      expect((await tx.query("select quote from claim_links where version_id = $1", [VERSION])).rows).toEqual([{ quote: "99.99% uptime, guaranteed" }]);
    });
  });

  it("moves the item to ai_audited", async () => {
    await asService(async (tx) => {
      await save(tx, payload());
      expect((await tx.query<{ status: string }>("select status from content_items where id = $1", [ITEM])).rows[0].status).toBe("ai_audited");
    });
  });

  it("accepts a rule-only run (AI skipped or failed) with no findings", async () => {
    await asService(async (tx) => {
      const { rows: [{ id }] } = await save(tx, payload({ mode: "rule_only", model: null, ai_available: false, findings: [] }));
      expect((await tx.query("select 1 from findings where run_id = $1", [id])).rows).toHaveLength(0);
    });
  });

  it("refuses a version from another organisation and unknown modes, and writes nothing", async () => {
    await asService(async (tx) => {
      await expect(save(tx, payload({ org_id: B }))).rejects.toThrow(/does not belong/);
    });
    await asService(async (tx) => {
      await expect(save(tx, payload({ mode: "hacked" }))).rejects.toThrow(/audit_runs_mode_check/);
    });
    expect((await db.query("select count(*)::int as n from audit_runs")).rows[0]).toEqual({ n: 0 });
  });

  it("cannot be called by signed-in users or anon, only by the server", async () => {
    await asUser(db, REVIEWER, async (tx) => {
      await expect(save(tx, payload())).rejects.toThrow(/permission denied/);
    });
  });

  it("the creator reads their run and findings through RLS; another org's owner sees nothing", async () => {
    let runId = "";
    await db.transaction(async (tx) => {
      await tx.exec("set local role service_role");
      runId = (await save(tx, payload())).rows[0].id;
      await tx.exec("reset role");
      await tx.exec(`set local role authenticated; select set_config('request.jwt.claims', '{"sub":"${CREATOR}"}', true);`);
      const mine = (await tx.query<{ n: number }>("select count(*)::int as n from findings where run_id = $1", [runId])).rows[0].n;
      expect(mine).toBe(6);
      await tx.exec(`select set_config('request.jwt.claims', '{"sub":"${B_OWNER}"}', true);`);
      const theirs = (await tx.query<{ n: number }>("select count(*)::int as n from findings where run_id = $1", [runId])).rows[0].n;
      expect(theirs).toBe(0);
      await tx.rollback();
    });
  });
});

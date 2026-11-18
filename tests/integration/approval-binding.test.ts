import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { asUser, createDb } from "../db/harness";

// Migration 20261117000100: approval is bound to the latest, audited, up-to-date version, and records what it approved.
const A = "00000000-0000-4000-8000-00000000000a";
const CREATOR = "00000000-0000-4000-8000-0000000000c1";
const REVIEWER = "00000000-0000-4000-8000-0000000000c2";
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const ITEM_OLD = id(101), V1 = id(201), V2 = id(202);
const ITEM_NEW = id(102), V3 = id(203);
const ITEM_STALE = id(103), V4 = id(204);

let db: PGlite;
beforeAll(async () => {
  db = await createDb();
  await db.exec(`
    insert into auth.users (id, email) values ('${CREATOR}','c@a.test'),('${REVIEWER}','r@a.test');
    insert into organizations (id, name) values ('${A}','Org A');
    insert into memberships values ('${A}','${CREATOR}','creator'),('${A}','${REVIEWER}','reviewer');
    insert into guideline_clauses (org_id, code, category, text) values ('${A}','CLAIM-02','claim','No "guaranteed".');
    insert into terminology (org_id, code, term, kind) values ('${A}','TERM-02','NB Sync','banned');
    insert into content_items (id, org_id, title, owner_id) values ('${ITEM_OLD}','${A}','Two versions','${CREATOR}'),
      ('${ITEM_NEW}','${A}','Not audited','${CREATOR}'),('${ITEM_STALE}','${A}','Stale','${CREATOR}');
    insert into content_versions (id, org_id, item_id, n, text, sha256, created_by) values
      ('${V1}','${A}','${ITEM_OLD}',1,'one','hash-1','${CREATOR}'),('${V2}','${A}','${ITEM_OLD}',2,'two','hash-2','${CREATOR}'),
      ('${V3}','${A}','${ITEM_NEW}',1,'new','hash-3','${CREATOR}'),('${V4}','${A}','${ITEM_STALE}',1,'stale','hash-4','${CREATOR}');
    insert into audit_runs (org_id, version_id, mode) values ('${A}','${V1}','rule_only'),('${A}','${V2}','rule_only'),('${A}','${V4}','rule_only');
  `);
}, 120_000);

const approve = (item: string, version: string) =>
  asUser(db, REVIEWER, async (tx) => {
    try {
      await tx.query("insert into decisions (org_id, item_id, version_id, author_id, decision) values ($1,$2,$3,$4,'approve')", [A, item, version, REVIEWER]);
      return (await tx.query<{ run_id: string; content_sha256: string; knowledge_rev: number; status: string }>(
        "select d.run_id, d.content_sha256, d.knowledge_rev::int, i.status::text from decisions d join content_items i on i.id = d.item_id where d.version_id = $1", [version])).rows[0];
    } catch (e) {
      return (e as Error).message;
    }
  });
const rev = async () => (await db.query<{ r: number }>(`select knowledge_rev::int as r from organizations where id = '${A}'`)).rows[0].r;

describe("approval bound to what was reviewed", () => {
  it("refuses an older version of the item", async () => {
    expect(await approve(ITEM_OLD, V1)).toMatch(/not the latest version/);
  });

  it("refuses a version that was never audited", async () => {
    expect(await approve(ITEM_NEW, V3)).toMatch(/version not audited/);
  });

  it("approves the latest audited version and records its hash, run and knowledge revision (set by the database)", async () => {
    const run = (await db.query<{ id: string }>(`select id from audit_runs where version_id = '${V2}'`)).rows[0].id;
    expect(await approve(ITEM_OLD, V2)).toEqual({ run_id: run, content_sha256: "hash-2", knowledge_rev: await rev(), status: "approved" });
  });
});

describe("knowledge revision and stale audits", () => {
  it("any change to guidelines, facts, terms or assets bumps the revision, including a delete", async () => {
    const r0 = await rev();
    await db.exec(`update guideline_clauses set text = 'Never say "guaranteed".' where code = 'CLAIM-02'`);
    await db.exec(`insert into approved_facts (org_id, code, statement) values ('${A}','FACT-01','x')`);
    await db.exec(`delete from terminology where code = 'TERM-02'`);
    await db.exec(`insert into brand_assets (org_id, type, name, hex) values ('${A}','color','Navy','#001f3f')`);
    expect(await rev()).toBe(r0 + 4);
  });

  it("an audit made before the change cannot be approved; a new audit of the same version can", async () => {
    expect(await approve(ITEM_STALE, V4)).toMatch(/audit is stale/);
    await db.exec(`insert into audit_runs (org_id, version_id, mode, created_at) values ('${A}','${V4}','rule_only', now() + interval '1 second')`);
    expect(await approve(ITEM_STALE, V4)).toMatchObject({ content_sha256: "hash-4", knowledge_rev: await rev(), status: "approved" });
  });

  it("a run's revision is stamped by the database, whatever the caller sends", async () => {
    await db.exec(`insert into audit_runs (org_id, version_id, mode, knowledge_rev) values ('${A}','${V3}','rule_only', 999999)`);
    expect((await db.query<{ r: number }>(`select knowledge_rev::int as r from audit_runs where version_id = '${V3}'`)).rows[0].r).toBe(await rev());
  });
});

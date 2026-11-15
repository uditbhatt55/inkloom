import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createDb } from "../db/harness";

const ORG = "00000000-0000-4000-8000-000000000001";
const OTHER = "00000000-0000-4000-8000-000000000002";
const OWNER = "00000000-0000-4000-8000-0000000000f1";
const REVIEWER = "00000000-0000-4000-8000-0000000000f2";
const sql = (f: string) => readFileSync(`supabase/${f}`, "utf8");
const history = sql("demo-history.sql").replace("owner@example.com", "own@nb.test").replace("reviewer@example.com", "rev@nb.test");

describe("supabase/demo-reset.sql", () => {
  it("brings the demo org back to the seed after a judge edited it, and leaves other orgs and members alone", async () => {
    const db = await createDb();
    await db.exec(sql("seed.sql"));
    await db.exec(`
      insert into auth.users (id, email) values ('${OWNER}','own@nb.test'),('${REVIEWER}','rev@nb.test');
      insert into memberships values ('${ORG}','${OWNER}','owner'),('${ORG}','${REVIEWER}','reviewer');
      insert into organizations (id, name) values ('${OTHER}', 'Other org');
      insert into terminology (org_id, code, term, kind) values ('${OTHER}', 'TERM-01', 'Keep me', 'banned');`);
    const state = async () => (await db.query<{ k: string; n: number }>(`
      select 'items' k, count(*)::int n from content_items where org_id = '${ORG}'
      union all select 'approved', count(*)::int from content_items where org_id = '${ORG}' and status = 'approved'
      union all select 'clauses', count(*)::int from guideline_clauses where org_id = '${ORG}'
      union all select 'history', count(*)::int from guideline_clause_history where org_id = '${ORG}'
      union all select 'facts', count(*)::int from approved_facts where org_id = '${ORG}'
      union all select 'terms', count(*)::int from terminology where org_id = '${ORG}'
      union all select 'assets', count(*)::int from brand_assets where org_id = '${ORG}'
      union all select 'members', count(*)::int from memberships where org_id = '${ORG}'
      union all select 'other_terms', count(*)::int from terminology where org_id = '${OTHER}'
      order by k`)).rows.map((r) => `${r.k}=${r.n}`).join(" ");

    await db.exec(history);
    const fresh = await state();
    expect(fresh).toContain("items=12");
    expect(fresh).toContain("approved=4");

    // a judge edits a rule, a fact and a term, and adds a post
    await db.exec(`
      update guideline_clauses set text = 'Changed by a judge.' where org_id = '${ORG}' and code = 'CLAIM-02';
      update approved_facts set statement = 'Northbeam Sync SLA: 99.99% monthly uptime' where org_id = '${ORG}' and code = 'FACT-07';
      insert into terminology (org_id, code, term, kind) values ('${ORG}', 'TERM-99', 'Extra', 'banned');
      insert into content_items (org_id, title, owner_id) values ('${ORG}', 'Judge post', '${OWNER}');`);
    expect(await state()).not.toBe(fresh);

    await db.exec(sql("demo-reset.sql"));
    expect(await state()).toContain("items=0");
    await db.exec(sql("seed.sql"));
    await db.exec(history);
    expect(await state()).toBe(fresh);
    const fact = await db.query<{ statement: string }>(`select statement from approved_facts where org_id = '${ORG}' and code = 'FACT-07'`);
    expect(fact.rows[0].statement).toBe("Northbeam Sync SLA: 99.9% monthly uptime");

    await db.exec(sql("demo-reset.sql")); // twice is fine
    await db.close();
  }, 120_000);
});

import { readFileSync } from "node:fs";
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { factImpact, recurringMistakes, unclearRules, type HealthFinding } from "@/lib/health/detectors";
import { createDb } from "../db/harness";

const ORG = "00000000-0000-4000-8000-000000000001";
const OWNER = "00000000-0000-4000-8000-0000000000f1";
const REVIEWER = "00000000-0000-4000-8000-0000000000f2";
const history = readFileSync("supabase/demo-history.sql", "utf8")
  .replace("owner@example.com", "own@nb.test").replace("reviewer@example.com", "rev@nb.test");

let db: PGlite;
const today = new Date().toISOString().slice(0, 10);

beforeAll(async () => {
  db = await createDb();
  await db.exec(readFileSync("supabase/seed.sql", "utf8"));
  await db.exec(`
    insert into auth.users (id, email) values ('${OWNER}','own@nb.test'),('${REVIEWER}','rev@nb.test');
    insert into memberships values ('${ORG}','${OWNER}','owner'),('${ORG}','${REVIEWER}','reviewer');
  `);
  await db.exec(history);
  await db.exec(history); // second run must change nothing
}, 120_000);

/** The same joins loadBrandHealth makes through supabase-js, in SQL. */
async function rows(q: Pick<PGlite, "query"> = db) {
  const findings = (await q.query<HealthFinding>(`
    select f.rule_code as "ruleCode", f.status::text, f.quote, i.channel, m.role::text as "creatorRole", r.created_at::text as at
    from findings f join audit_runs r on r.id = f.run_id join content_versions v on v.id = r.version_id
    join content_items i on i.id = v.item_id left join memberships m on m.user_id = i.owner_id and m.org_id = i.org_id`)).rows;
  const links = (await q.query<{ factId: string; itemId: string; itemTitle: string; approvedAt: string | null }>(`
    select l.fact_id as "factId", i.id as "itemId", i.title as "itemTitle",
           (select max(d.created_at)::text from decisions d where d.item_id = i.id and d.decision = 'approve') as "approvedAt"
    from claim_links l join content_versions v on v.id = l.version_id join content_items i on i.id = v.item_id
    where i.status = 'approved'`)).rows;
  const facts = (await q.query<{ id: string; code: string; statement: string; validUntil: string | null; updatedAt: string }>(`
    select id, code, statement, valid_until::text as "validUntil", updated_at::text as "updatedAt" from approved_facts`)).rows;
  return { findings, links, facts };
}

describe("supabase/demo-history.sql (Brand Health seeded history, M5)", () => {
  it("adds 12 posts once, 4 approved through the approval gate", async () => {
    const r = (await db.query<{ n: number; approved: number; decisions: number }>(`
      select count(*)::int as n, count(*) filter (where status = 'approved')::int as approved,
             (select count(*)::int from decisions) as decisions from content_items`)).rows[0];
    expect(r).toEqual({ n: 12, approved: 4, decisions: 4 });
  });

  it("every finding quote sits at its offsets in the post text", async () => {
    const bad = (await db.query(`
      select f.quote from findings f join audit_runs r on r.id = f.run_id join content_versions v on v.id = r.version_id
      where substr(v.text, f.start_offset + 1, f.end_offset - f.start_offset) <> f.quote`)).rows;
    expect(bad).toEqual([]);
  });

  it("gives the storyline: NB Sync is the top recurring mistake, CLAIM-02 is unclear, FACT-05 has expired under an approved email", async () => {
    const { findings, links, facts } = await rows();
    const recurring = recurringMistakes(findings, today);
    expect(recurring[0]).toMatchObject({ ruleCode: "TERM-02", count: 5 });
    expect(unclearRules(findings)).toEqual([expect.objectContaining({ ruleCode: "CLAIM-02", decided: 5, overruled: 3 })]);
    const alerts = factImpact(facts, links, today);
    expect(alerts.map((a) => [a.code, a.reason, a.items.map((i) => i.title)])).toEqual([["FACT-05", "expired", ["Vault launch email"]]]);
  });

  it("editing FACT-07 makes the three approved posts that rely on it show up as changed", async () => {
    await db.transaction(async (tx) => {
      await tx.exec("update approved_facts set statement = 'Northbeam Sync SLA: 99.95% monthly uptime' where code = 'FACT-07'");
      const { links, facts } = await rows(tx);
      const fact07 = factImpact(facts, links, today).find((a) => a.code === "FACT-07");
      expect(fact07?.reason).toBe("changed");
      expect(fact07?.items.map((i) => i.title).sort()).toEqual(["Product page update", "Reliability LinkedIn post", "Sales one-pager"]);
      await tx.rollback();
    });
  });
});
